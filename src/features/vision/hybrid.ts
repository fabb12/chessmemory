import type { Side } from '../../types';
import type { BoardReading } from '../assistant/claude';
import { resolveReading, type ReadingReference, type ResolvedReading } from '../assistant/boardResolve';
import type { BoardView } from '../assistant/boardReading';
import { evidenceGrid, uncertainCount, detectionsToEvidence, type Evidence } from './evidence';
import { plausibleCorners, type Corners } from './geometry';
import { refineCorners, type GrayImage } from './gridFit';
import { detectorStatus, detectPieces } from './pieceDetector';

/**
 * Visione ibrida: geometria classica + YOLO sul dispositivo, Claude solo se serve.
 *
 *  1. gli angoli della scacchiera vengono rifiniti agganciando il reticolo degli
 *     incroci (punti di sella), come in chessAutomation_CV;
 *  2. YOLO trova i pezzi e ciascuno viene assegnato alla casa sotto la sua base;
 *  3. la lettura viene confrontata con le posizioni raggiungibili con mosse
 *     legali: se una spiega la foto con sicurezza, è quella (zero token, ~0,3 s);
 *  4. altrimenti Claude legge la foto sapendo che cosa ha visto YOLO e dove è
 *     incerto, e le due letture vengono fuse casa per casa.
 */

export interface VisionResult {
  /** Angoli (frazioni dell'immagine), rifiniti se è stato possibile. */
  corners: Corners | null;
  refined: boolean;
  /** Evidenza YOLO per casa (ordine della foto), se il modello c'è e gli angoli sono noti. */
  evidence: Evidence | null;
}

const GRAY_SIDE = 480;

async function decode(base64Jpeg: string): Promise<ImageBitmap | null> {
  try {
    const blob = await (await fetch(`data:image/jpeg;base64,${base64Jpeg}`)).blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function grayOf(image: ImageBitmap): GrayImage | null {
  const scale = Math.min(1, GRAY_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  return { data: gray, width, height };
}

/** Gli angoli rifiniti non devono allontanarsi troppo da quelli di partenza (al massimo ~una casa). */
export function closeEnough(a: Corners, b: Corners): boolean {
  const side = Math.sqrt(Math.abs((a[2].x - a[0].x) * (a[3].y - a[1].y) - (a[3].x - a[1].x) * (a[2].y - a[0].y)) / 2) / 8;
  return a.every((p, k) => Math.hypot(p.x - b[k]!.x, p.y - b[k]!.y) <= 1.3 * side);
}

/** Analisi locale di una foto (JPEG base64): angoli rifiniti ed evidenza YOLO. */
export async function analyzeImage(base64Jpeg: string, corners: Corners | null): Promise<VisionResult> {
  const empty: VisionResult = { corners, refined: false, evidence: null };
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return empty;
  const image = await decode(base64Jpeg);
  if (!image) return empty;
  try {
    let quad = corners;
    let refined = false;
    if (quad) {
      const gray = grayOf(image);
      const fit = gray ? refineCorners(gray, quad) : null;
      if (fit && plausibleCorners(fit.corners, 0.05) && closeEnough(quad, fit.corners)) {
        quad = fit.corners;
        refined = true;
      }
    }
    let evidence: Evidence | null = null;
    const status = detectorStatus();
    if (quad && status !== 'missing' && status !== 'error') {
      const detections = await detectPieces(image, image.width, image.height);
      evidence = detections ? detectionsToEvidence(detections, quad) : null;
    }
    return { corners: quad, refined, evidence };
  } finally {
    image.close();
  }
}

export interface LocalInput {
  evidence: Evidence;
  reference: ReadingReference | null;
  forcedView: BoardView | null;
  lastView: BoardView | null;
  lastRawPlacement: string | null;
}

/** Massimo di «case sbagliate pesate» per fidarsi della sola visione locale. */
export const LOCAL_MAX_COST = 0.8;
/** Massimo di case incerte per fidarsi della sola visione locale. */
export const LOCAL_MAX_UNCERTAIN = 4;

export function resolveLocal(input: LocalInput): ResolvedReading {
  return resolveReading({
    grid: evidenceGrid(input.evidence),
    evidence: input.evidence,
    claimedView: input.forcedView ?? input.lastView ?? 'bottom',
    forcedView: input.forcedView,
    reference: input.reference,
    lastRawPlacement: input.lastRawPlacement,
  });
}

/**
 * La lettura locale basta (senza Claude) solo se è una posizione legale vicina
 * a quella nota (o alla partenza) che spiega la foto quasi senza correzioni,
 * con poche case incerte.
 */
export function trustLocal(resolved: ResolvedReading, evidence: Evidence): boolean {
  return (
    resolved.fitCost !== null &&
    resolved.fitCost <= LOCAL_MAX_COST &&
    resolved.problems.length === 0 &&
    uncertainCount(evidence) <= LOCAL_MAX_UNCERTAIN
  );
}

/** Lettura completa costruita dalla sola visione locale. */
export function localBoardReading(resolved: ResolvedReading, evidence: Evidence, corners: Corners | null): BoardReading {
  const turn: Side | null = resolved.turn;
  return {
    placement: resolved.placement,
    fen: resolved.fen,
    sideToMove: turn ?? 'unknown',
    turnKnown: turn !== null,
    confidence: uncertainCount(evidence) === 0 && (resolved.fitCost ?? 1) < 0.3 ? 'high' : 'medium',
    notes: '',
    grid: evidenceGrid(evidence),
    view: resolved.view,
    rawPlacement: resolved.rawPlacement,
    corrected: resolved.corrected,
    moves: resolved.moves,
    corners,
    source: 'local',
  };
}
