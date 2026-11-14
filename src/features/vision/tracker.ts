import type { BoardView } from '../assistant/boardReading';
import { legalTransitions, matchTransition, type MatchResult, type Transition } from '../engine/moveMatcher';
import { CvClient, type FrameResult } from './cvClient';
import { cellToSquare, type Corners } from './geometry';
import { StabilityTracker, thumbnailDifference, type MotionState } from './motion';
import { classifyOccupancy, detectView, learnOccupancy, type OccupancyModel } from './occupancy';
import { FootprintLock, geometryForView, type FootprintName } from './perspective';
import { featureChanges } from './squareFeatures';

/**
 * Inseguimento della partita sulla scacchiera reale, tutto nel browser.
 *
 *  1. ogni ~100 ms un fotogramma va al Web Worker della visione (raddrizzato,
 *     miniatura, descrittori delle case);
 *  2. finché l'immagine si muove (mano sulla scacchiera) non si fa nulla;
 *  3. quando torna ferma da almeno 350 ms e differisce dall'ultimo controllo,
 *     si confrontano le case con il fotogramma della posizione nota e si cerca
 *     la transizione (mossa legale o altra attesa) che spiega i cambiamenti;
 *  4. chi usa il tracker decide se accettarla (`commit`): il fotogramma nuovo
 *     diventa il riferimento e il classificatore vuota/bianco/nero si aggiorna.
 */

export type TrackerStatus = MotionState | 'syncing' | 'idle';

export interface TrackerSource {
  video: () => HTMLVideoElement | null;
  corners: () => Corners | null;
  /** Posizione che si crede sia sulla scacchiera. */
  fen: () => string | null;
  /** Transizioni in più oltre alle mosse legali (es. riportare indietro una mossa sbagliata). */
  extraTransitions?: () => Transition[];
  /** Transizione attesa (validazione istantanea della mossa del Maestro). */
  preferred?: () => string | null;
  /** La transizione attesa è stata indicata all'utente: si riconosce con soglie più tolleranti. */
  lenient?: () => boolean;
}

export interface TrackerEvents {
  onStatus?: (status: TrackerStatus) => void;
  /** Esito di un controllo dopo che la scena si è fermata. */
  onResult?: (result: MatchResult) => void;
  /** Orientamento dedotto alla sincronizzazione. */
  onView?: (view: BoardView, margin: number) => void;
  onPreview?: (preview: ImageBitmap | ImageData) => void;
}

const FRAME_MS = 100;
/** Ogni quanti fotogrammi aggiornare l'anteprima raddrizzata. */
const PREVIEW_EVERY = 5;
/** Differenza dall'ultimo controllo oltre la quale vale la pena ricontrollare. */
const RECHECK_DIFFERENCE = 0.006;

export class BoardTracker {
  private readonly cv = new CvClient();
  private readonly motion = new StabilityTracker();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private frameCount = 0;
  private baseline: FrameResult | null = null;
  private lastChecked: Uint8Array | null = null;
  private model: OccupancyModel | null = null;
  private latest: FrameResult | null = null;
  private syncRequested = false;
  private recheckRequested = false;
  private status: TrackerStatus = 'idle';
  /** Orientamento usato per passare dalle celle dell'immagine alle case. */
  view: BoardView = 'bottom';
  /** Impronta dei pezzi che ha spiegato l'ultima mossa (dipende dall'inclinazione della fotocamera). */
  footprint: FootprintName = 'tilted';
  private readonly footprintLock = new FootprintLock();
  /** Se true, alla sincronizzazione l'orientamento si deduce dalla posizione. */
  autoView = true;
  previewEnabled = true;

  constructor(
    private readonly source: TrackerSource,
    private readonly events: TrackerEvents = {},
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.motion.reset();
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setStatus('idle');
  }

  dispose(): void {
    this.stop();
    this.cv.dispose();
  }

  /** Il prossimo fotogramma stabile diventa il riferimento della posizione attuale. */
  resync(): void {
    this.syncRequested = true;
    // Nuova calibrazione o nuovo orientamento: l'inclinazione va riaccertata.
    this.footprintLock.reset();
    this.baseline = null;
    this.setStatus('syncing');
  }

  /** Ricontrolla subito (es. dopo che l'utente ha sistemato un pezzo). */
  recheck(): void {
    this.recheckRequested = true;
  }

  /** La transizione è stata accettata: il fotogramma attuale è il nuovo riferimento. */
  commit(fen: string): void {
    const frame = this.latest;
    if (!frame) {
      this.resync();
      return;
    }
    this.baseline = frame;
    this.lastChecked = frame.thumb;
    this.model = learnOccupancy(frame.features, fen, this.view, this.footprint) ?? this.model;
  }

  get synced(): boolean {
    return this.baseline !== null;
  }

  /** Rilevamento automatico degli angoli (nel worker). */
  detectCorners(): Promise<{ corners: Corners | null; matched: number }> {
    const video = this.source.video();
    return video ? this.cv.detect(video) : Promise.resolve({ corners: null, matched: 0 });
  }

  private setStatus(status: TrackerStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.events.onStatus?.(status);
  }

  private tick = async (): Promise<void> => {
    if (!this.running) return;
    const started = performance.now();
    try {
      await this.step();
    } catch {
      // un fotogramma perso non ferma l'inseguimento
    }
    if (!this.running) return;
    this.timer = setTimeout(this.tick, Math.max(0, FRAME_MS - (performance.now() - started)));
  };

  private async step(): Promise<void> {
    const video = this.source.video();
    const corners = this.source.corners();
    const fen = this.source.fen();
    if (!video || !corners || !fen) return;
    const preview = this.previewEnabled && this.frameCount++ % PREVIEW_EVERY === 0;
    const frame = await this.cv.process(video, corners, preview);
    if (!frame || !this.running) return;
    if (frame.preview) this.events.onPreview?.(frame.preview);
    this.latest = frame;
    const { state } = this.motion.push(frame.thumb, performance.now());
    if (state !== 'stable') {
      this.setStatus(state);
      return;
    }
    if (this.syncRequested || !this.baseline) {
      this.syncRequested = false;
      if (this.autoView) {
        const { view, margin } = detectView(frame.features, fen);
        this.view = view;
        this.events.onView?.(view, margin);
      }
      this.commit(fen);
      this.setStatus('stable');
      return;
    }
    this.setStatus('stable');
    const changedSinceCheck = !this.lastChecked || thumbnailDifference(this.lastChecked, frame.thumb) > RECHECK_DIFFERENCE;
    if (!changedSinceCheck && !this.recheckRequested) return;
    this.recheckRequested = false;
    this.lastChecked = frame.thumb;
    const result = this.evaluate(frame, fen);
    if (result.kind === 'match' && result.footprint) this.footprint = result.footprint;
    if (result.kind !== 'none') this.footprintLock.record(result.kind === 'match' ? result.footprint : null);
    this.events.onResult?.(result);
  }

  /** Confronto del fotogramma con il riferimento della posizione `fen`. */
  private evaluate(frame: FrameResult, fen: string): MatchResult {
    const cells = featureChanges(this.baseline!.features, frame.features);
    const changes = new Map<string, number>();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) changes.set(cellToSquare(i, j, this.view), cells[i * 8 + j] ?? 0);
    const occupancy = this.model ? classifyOccupancy(this.model, frame.features, this.view) : null;
    const candidates = [...legalTransitions(fen), ...(this.source.extraTransitions?.() ?? [])];
    return matchTransition({ fen, candidates, changes, occupancy, preferred: this.source.preferred?.() ?? null, lenient: this.source.lenient?.() ?? false, geometry: geometryForView(this.view, this.footprint), footprint: this.footprintLock.locked });
  }
}

