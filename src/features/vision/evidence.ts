import type { BoardView } from '../assistant/boardReading';
import type { Corners } from './geometry';
import { applyMatrix, cornersMatrix, invertMatrix } from './gridFit';
import type { Detection } from './pieceDetector';

/**
 * «Evidenza» su ogni casa: la probabilità di ciascun simbolo ('.' = vuota,
 * K…p = pezzi) secondo una fonte (YOLO, Claude) o la loro combinazione.
 *
 * Tenere le probabilità, invece di un solo simbolo per casa, è ciò che rende
 * la fusione affidabile: dove YOLO è sicuro (0,95) e Claude dice altro, una
 * posizione legale vicina viene scelta in base a quanto è credibile ogni
 * correzione, non al semplice numero di case diverse.
 */

export const SYMBOLS = ['.', 'K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'] as const;
export type CellProbs = Record<string, number>;
/** 64 celle nell'ordine della foto: riga i dall'alto, colonna j da sinistra (i*8+j). */
export type Evidence = CellProbs[];

const FLOOR = 1e-4;

function normalize(p: CellProbs): CellProbs {
  const out: CellProbs = {};
  let sum = 0;
  for (const s of SYMBOLS) sum += Math.max(FLOOR, p[s] ?? 0);
  for (const s of SYMBOLS) out[s] = Math.max(FLOOR, p[s] ?? 0) / sum;
  return out;
}

/** Distribuzione con `confidence` sul simbolo e il resto sparso sugli altri. */
export function peaked(symbol: string, confidence: number): CellProbs {
  const rest = (1 - confidence) / (SYMBOLS.length - 1);
  const p: CellProbs = {};
  for (const s of SYMBOLS) p[s] = s === symbol ? confidence : rest;
  return p;
}

/** Fiducia nella lettura di Claude, casa per casa. */
export const CLAUDE_CONFIDENCE = 0.85;
/** Casa senza alcun pezzo rilevato da YOLO: probabilmente vuota (ma un pezzo può sfuggire). */
const EMPTY_CONFIDENCE = 0.88;

export function gridEvidence(grid: readonly string[], confidence = CLAUDE_CONFIDENCE): Evidence {
  const out: Evidence = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) out.push(peaked(grid[i]?.[j] ?? '.', confidence));
  return out;
}

/**
 * Da riquadri YOLO a evidenza per casa. Ogni pezzo sta sulla casa sotto la sua
 * BASE (il bordo inferiore del riquadro, un po' più in su): le teste dei pezzi
 * alti sporgono sulla casa dietro. Le coordinate dei riquadri e gli angoli sono
 * nella stessa immagine (frazioni 0–1).
 */
export function detectionsToEvidence(detections: readonly Detection[], corners: Corners): Evidence | null {
  const H = cornersMatrix(corners);
  const inv = H ? invertMatrix(H) : null;
  if (!H || !inv) return null;
  const cells: { piece: string; score: number; alternatives: Detection['alternatives'] }[][] = Array.from({ length: 64 }, () => []);
  for (const d of detections) {
    const cx = (d.x1 + d.x2) / 2;
    // Altezza di una casa in quel punto dell'immagine, per risalire dalla base al centro della casa.
    const foot = applyMatrix(inv, { x: cx, y: d.y2 });
    const above = applyMatrix(H, { x: foot.x, y: foot.y - 1 / 8 });
    const squareH = Math.max(0, d.y2 - above.y);
    const base = applyMatrix(inv, { x: cx, y: d.y2 - Math.min(0.45 * squareH, 0.3 * (d.y2 - d.y1)) });
    if (base.x < -0.03 || base.x > 1.03 || base.y < -0.03 || base.y > 1.03) continue; // pezzi fuori dalla scacchiera
    const j = Math.min(7, Math.max(0, Math.floor(base.x * 8)));
    const i = Math.min(7, Math.max(0, Math.floor(base.y * 8)));
    cells[i * 8 + j]!.push(d);
  }
  return cells.map((found) => {
    if (found.length === 0) return normalize(peaked('.', EMPTY_CONFIDENCE));
    const sorted = [...found].sort((a, b) => b.score - a.score);
    const p: CellProbs = {};
    let mass = 0;
    const add = (piece: string, score: number) => {
      const share = Math.max(0, Math.min(score, 0.97 - mass));
      p[piece] = (p[piece] ?? 0) + share;
      mass += share;
    };
    const top = sorted[0]!;
    add(top.piece, top.score);
    for (const alt of top.alternatives) add(alt.piece, alt.score * 0.8);
    // Due pezzi nella stessa casa: il secondo è probabilmente della casa vicina, ma resta un'ipotesi.
    for (const other of sorted.slice(1)) add(other.piece, other.score * 0.3);
    const rest = Math.max(0.03, 1 - mass);
    p['.'] = (p['.'] ?? 0) + rest * 0.5;
    for (const s of SYMBOLS) if (s !== '.') p[s] = (p[s] ?? 0) + (rest * 0.5) / 12;
    return normalize(p);
  });
}

/**
 * Peso di YOLO nella fusione con Claude. Le confidenze di YOLO non sono
 * probabilità tarate: su pezzi diversi da quelli dell'addestramento il modello
 * può dire «cavallo bianco 0,73» per un pedone nero. Con l'esponente 0,5 YOLO da
 * solo non smentisce mai Claude: lo conferma, lo aiuta sulle case dubbie e,
 * insieme alle mosse legali, decide tra le posizioni candidate.
 */
export const YOLO_WEIGHT = 0.5;

/** Evidenza «ammorbidita»: probabilità elevate a `weight` e rinormalizzate. */
export function temper(evidence: Evidence, weight: number): Evidence {
  return evidence.map((p) => {
    const out: CellProbs = {};
    for (const s of SYMBOLS) out[s] = Math.pow(Math.max(FLOOR, p[s] ?? 0), weight);
    return normalize(out);
  });
}

/** Combina fonti indipendenti (prodotto delle probabilità, poi normalizzato). */
export function fuseEvidence(...sources: (Evidence | null | undefined)[]): Evidence | null {
  const valid = sources.filter((s): s is Evidence => !!s && s.length === 64);
  if (valid.length === 0) return null;
  return Array.from({ length: 64 }, (_, k) => {
    const p: CellProbs = {};
    for (const s of SYMBOLS) p[s] = valid.reduce((acc, e) => acc * Math.max(FLOOR, e[k]![s] ?? 0), 1);
    return normalize(p);
  });
}

export function bestSymbol(p: CellProbs): { symbol: string; probability: number } {
  let symbol = '.';
  let probability = -1;
  for (const s of SYMBOLS) {
    if ((p[s] ?? 0) > probability) {
      probability = p[s] ?? 0;
      symbol = s;
    }
  }
  return { symbol, probability };
}

/** Griglia (come nella foto) con il simbolo più probabile di ogni casa. */
export function evidenceGrid(evidence: Evidence): string[] {
  return Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => bestSymbol(evidence[i * 8 + j]!).symbol).join(''));
}

/** Griglia per il prompt di Claude: «?» dove l'evidenza è incerta. */
export function hintGrid(evidence: Evidence, threshold = 0.7): string[] {
  return Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 8 }, (_, j) => {
      const best = bestSymbol(evidence[i * 8 + j]!);
      return best.probability >= threshold ? best.symbol : '?';
    }).join(''),
  );
}

/** Quanti pezzi YOLO vede con almeno questa sicurezza. */
export function detectedPieces(evidence: Evidence, threshold = 0.5): number {
  return evidence.filter((p) => {
    const best = bestSymbol(p);
    return best.symbol !== '.' && best.probability >= threshold;
  }).length;
}

/**
 * YOLO è utile su questa foto solo se vede buona parte dei pezzi che ci sono
 * (`expected`, dalla posizione nota o dalla lettura di Claude). Con pezzi molto
 * diversi da quelli dell'addestramento, o con luce e inquadratura difficili, ne
 * vede pochissimi: allora una sua lettura quasi vuota non deve far credere che le
 * case siano vuote, né a Claude né alle regole, e viene ignorata.
 */
export function informative(evidence: Evidence, expected: number): boolean {
  return detectedPieces(evidence) >= Math.max(2, 0.6 * expected);
}

/** Quante case hanno un'evidenza incerta. */
export function uncertainCount(evidence: Evidence, threshold = 0.6): number {
  return evidence.filter((p) => bestSymbol(p).probability < threshold).length;
}

/** Cella della foto che corrisponde alla casa (traversa r dall'ottava, colonna f da «a»): inverso di gridToRanks. */
export function cellOf(r: number, f: number, view: BoardView): number {
  switch (view) {
    case 'bottom':
      return r * 8 + f;
    case 'top':
      return (7 - r) * 8 + (7 - f);
    case 'left':
      return f * 8 + (7 - r);
    case 'right':
      return (7 - f) * 8 + r;
  }
}

/** Evidenza riordinata per case dal punto di vista del Bianco (indice r*8+f, dall'ottava traversa). */
export function evidenceToRanks(evidence: Evidence, view: BoardView): Evidence {
  const out: Evidence = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out.push(evidence[cellOf(r, f, view)]!);
  return out;
}
