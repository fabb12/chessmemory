import type { Side } from '../../types';
import { BOARD_VIEWS, countPieces, placementToRanks, ranksToGrid, type BoardView } from '../assistant/boardReading';
import { resolveReading, type ReadingReference, type ResolvedReading } from '../assistant/boardResolve';
import type { BoardReading, ReadOptions } from '../assistant/claude';
import type { Corners } from './geometry';
import {
  evidenceGrid,
  evidenceToRanks,
  fuseEvidence,
  fuseViews,
  gridEvidence,
  informative,
  temper,
  uncertainCount,
  YOLO_WEIGHT,
  type Evidence,
} from './evidence';
import { LOCAL_MAX_COST, LOCAL_MAX_UNCERTAIN, type VisionResult } from './hybrid';

/**
 * Lettura della posizione da poche foto guidate (di solito due).
 *
 *  - Foto 1, dal proprio lato: dà orientamento e prima lettura.
 *  - Foto 2, dal lato destro (90°): i pezzi coperti da quelli più alti nella
 *    foto 1 qui sono di fianco, quindi visibili.
 *
 * Per ogni foto: prima YOLO sul dispositivo (scacchiera trovata da sola, ~0,5 s);
 * Claude solo se YOLO + regole non bastano. Le letture di tutte le foto vengono
 * portate nel punto di vista del Bianco e fuse casa per casa (`fuseViews`: un
 * pezzo visto in una foto e coperto nell'altra resta). Infine le mosse legali
 * scelgono la posizione più credibile.
 */

export interface ShotReading {
  vision: VisionResult;
  claude: BoardReading | null;
}

export interface ShotContext {
  reference: ReadingReference | null;
  forcedView: BoardView | null;
  lastView: BoardView | null;
}

export interface CombinedReading {
  resolved: ResolvedReading;
  /** Evidenza fusa, per case dal punto di vista del Bianco (indice r*8+f dall'ottava traversa). */
  evidence: Evidence;
  /** Orientamento della foto di riferimento (la prima letta da Claude, o la prima con YOLO). */
  view: BoardView;
  /** Foto che hanno contribuito. */
  shots: number;
  /** Letture indipendenti (Claude e YOLO informativo contano una ciascuno). */
  sources: number;
  notes: string;
}

/** Evidenza YOLO della foto, solo se vede buona parte dei pezzi attesi. */
function usefulYolo(vision: VisionResult, expected: number): Evidence | null {
  return vision.evidence && informative(vision.evidence, expected) ? vision.evidence : null;
}

/** Concordanza tra due evidenze per case (prodotto scalare medio). */
function agreement(a: Evidence, b: Evidence): number {
  let sum = 0;
  for (let k = 0; k < 64; k++) for (const s of Object.keys(a[k]!)) sum += (a[k]![s] ?? 0) * (b[k]![s] ?? 0);
  return sum / 64;
}

/**
 * Orientamento di una foto rispetto a una lettura già fatta: quello in cui la
 * foto, riportata al punto di vista del Bianco, le somiglia di più. Non serve
 * sapere da che lato si è girato l'utente per la foto 2.
 */
export function alignView(photo: Evidence, ranks: Evidence): BoardView {
  let best: BoardView = 'bottom';
  let score = -1;
  for (const view of BOARD_VIEWS) {
    const s = agreement(evidenceToRanks(photo, view), ranks);
    if (s > score) {
      score = s;
      best = view;
    }
  }
  return best;
}

/** Fonde le foto lette finora. Null se nessuna dà una lettura utilizzabile. */
export function combineShots(shots: readonly ShotReading[], ctx: ShotContext): CombinedReading | null {
  const known = ctx.reference ? countPieces(placementToRanks(ctx.reference.fen.split(' ')[0] ?? '')) : null;
  const expectedOf = (shot: ShotReading) => {
    const seen = shot.claude ? countPieces(shot.claude.grid) : known;
    return seen ? seen.white + seen.black : 0;
  };
  // Evidenza di ogni foto, nell'ordine della foto.
  const photos = shots.map((shot) => {
    const yolo = usefulYolo(shot.vision, expectedOf(shot));
    if (shot.claude) {
      const claude = gridEvidence(shot.claude.grid);
      return { evidence: yolo ? fuseEvidence(claude, temper(yolo, YOLO_WEIGHT))! : claude, view: shot.claude.view as BoardView | null, sources: yolo ? 2 : 1 };
    }
    return yolo ? { evidence: yolo, view: null as BoardView | null, sources: 1 } : null;
  });
  // Foto di riferimento: la prima letta da Claude (orientamento già verificato), altrimenti la prima con YOLO.
  const anchorIndex = photos.findIndex((p) => p?.view) >= 0 ? photos.findIndex((p) => p?.view) : photos.findIndex((p) => p);
  const anchor = photos[anchorIndex];
  if (!anchor) return null;
  let anchorView = anchor.view;
  if (!anchorView) {
    // Solo YOLO: l'orientamento lo decidono le regole (posizione nota o di partenza, anche ruotando la foto).
    anchorView = resolveReading({
      grid: evidenceGrid(anchor.evidence),
      evidence: anchor.evidence,
      claimedView: ctx.forcedView ?? ctx.lastView ?? 'bottom',
      forcedView: ctx.forcedView,
      reference: ctx.reference,
    }).view;
  }
  const anchorRanks = evidenceToRanks(anchor.evidence, anchorView);
  const ranks: Evidence[] = [anchorRanks];
  let sources = anchor.sources;
  photos.forEach((p, k) => {
    if (!p || k === anchorIndex) return;
    ranks.push(evidenceToRanks(p.evidence, p.view ?? alignView(p.evidence, anchorRanks)));
    sources += p.sources;
  });
  const fused = fuseViews(ranks)!;
  const resolved = resolveReading({
    grid: evidenceGrid(fused),
    evidence: fused,
    claimedView: 'bottom',
    forcedView: 'bottom',
    reference: ctx.reference,
  });
  const notes = shots
    .map((s) => s.claude?.notes.trim() ?? '')
    .filter(Boolean)
    .join(' · ');
  return { resolved: { ...resolved, view: anchorView }, evidence: fused, view: anchorView, shots: ranks.length, sources, notes };
}

/**
 * La lettura è sicura (nessuna altra foto serve): spiegata da mosse legali dalla
 * posizione nota (o di partenza) quasi senza correzioni, oppure confermata da
 * almeno due letture indipendenti che concordano su quasi tutte le case.
 */
export function isSure(c: CombinedReading): boolean {
  if (c.resolved.problems.length > 0) return false;
  if (c.resolved.fitCost !== null && c.resolved.fitCost <= LOCAL_MAX_COST && uncertainCount(c.evidence) <= LOCAL_MAX_UNCERTAIN) return true;
  return c.sources >= 2 && c.resolved.corrected.length === 0 && uncertainCount(c.evidence) <= 1;
}

/** Lettura completa per la pagina, dalla fusione delle foto. */
export function toBoardReading(c: CombinedReading, shots: readonly ShotReading[]): BoardReading {
  const turn: Side | null = c.resolved.turn;
  const claude = shots.filter((s) => s.claude).length;
  const uncertain = uncertainCount(c.evidence);
  const confidence: BoardReading['confidence'] =
    c.resolved.problems.length > 0 ? 'low' : isSure(c) ? 'high' : uncertain <= 4 ? 'medium' : 'low';
  // Griglia come nella foto di riferimento: «Ruota la lettura» la reinterpreta senza rileggere.
  return {
    placement: c.resolved.placement,
    fen: c.resolved.fen,
    sideToMove: turn ?? shots.find((s) => s.claude && s.claude.sideToMove !== 'unknown')?.claude?.sideToMove ?? 'unknown',
    turnKnown: turn !== null,
    confidence,
    notes: c.notes,
    grid: ranksToGrid(evidenceGrid(c.evidence), c.view),
    view: c.view,
    rawPlacement: c.resolved.rawPlacement,
    corrected: c.resolved.corrected,
    moves: c.resolved.moves,
    corners: shots[0]?.vision.corners ?? null,
    source: claude === 0 ? 'local' : c.sources > claude ? 'hybrid' : 'claude',
  };
}

export interface ShotDeps {
  /** YOLO sul dispositivo (scacchiera cercata da sola se gli angoli sono null). */
  local: (image: string, corners: Corners | null) => Promise<VisionResult>;
  /** Lettura con Claude; null se non c'è la chiave API. */
  claude: ((image: string, options: ReadOptions) => Promise<BoardReading>) | null;
}

export interface ShotSessionOptions extends ShotContext {
  flippedCoordinates: boolean;
  lastRawPlacement: string | null;
}

/**
 * Sessione di foto guidate. Ogni foto parte subito (YOLO, poi Claude solo se
 * serve) mentre l'utente si sposta per la successiva; una foto aspetta le
 * precedenti solo per decidere se chiamare Claude.
 */
export class ShotSession {
  private readonly shots: Promise<ShotReading>[] = [];

  constructor(
    private readonly options: ShotSessionOptions,
    private readonly deps: ShotDeps,
  ) {}

  get count(): number {
    return this.shots.length;
  }

  /** Aggiunge una foto (JPEG base64) e restituisce la fusione di tutte quelle scattate finora. */
  add(image: string): Promise<CombinedReading | null> {
    const previous = [...this.shots];
    this.shots.push(this.read(image, previous));
    return this.current();
  }

  async current(): Promise<CombinedReading | null> {
    return combineShots(await this.all(), this.options);
  }

  all(): Promise<ShotReading[]> {
    return Promise.all(this.shots);
  }

  private async read(image: string, previous: Promise<ShotReading>[]): Promise<ShotReading> {
    let vision: VisionResult;
    try {
      vision = await this.deps.local(image, null);
    } catch {
      vision = { corners: null, refined: false, evidence: null };
    }
    // Le foto precedenti servono solo a decidere se questa basta con YOLO.
    const before = (await Promise.allSettled(previous)).flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const withLocal = combineShots([...before, { vision, claude: null }], this.options);
    if (!this.deps.claude || (withLocal && isSure(withLocal))) return { vision, claude: null };
    let seen = vision;
    const claude = await this.deps.claude(image, {
      reference: this.options.reference,
      view: this.options.forcedView,
      lastView: this.options.lastView,
      lastRawPlacement: this.options.lastRawPlacement,
      flippedCoordinates: this.options.flippedCoordinates,
      vision: vision.corners ? vision : null,
      // Scacchiera non trovata da sola: YOLO legge la foto con gli angoli trovati da Claude.
      analyze: vision.corners
        ? undefined
        : async (corners) => {
            seen = await this.deps.local(image, corners);
            return seen;
          },
    });
    return { vision: seen, claude };
  }
}
