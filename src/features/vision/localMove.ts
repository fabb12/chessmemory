import { Chess, type Move } from 'chess.js';
import type { Uci } from '../../types';
import type { BoardView } from '../assistant/boardReading';
import { cellToSquare } from './geometry';

/**
 * Riconoscimento della mossa SENZA Claude, nell'analisi continua.
 *
 * Con la fotocamera ferma e gli angoli della scacchiera noti, si confronta
 * ogni casa tra il fotogramma della posizione precedente e quello attuale.
 * Tra le mosse legali si cerca quella le cui case (partenza, arrivo, torre
 * dell'arrocco, pedone preso en passant) sono cambiate tutte, mentre le altre
 * mosse no. Se il risultato è netto la mossa è accettata subito (mezzo secondo
 * invece di qualche secondo, e senza costi); se è dubbio si chiede a Claude.
 */

/** Punti campionati per lato in ogni casa. */
export const SAMPLES_PER_SIDE = 4;
const VALUES_PER_CELL = SAMPLES_PER_SIDE * SAMPLES_PER_SIDE * 3;

/** Sotto questa differenza media (0–255) nessuna casa è davvero cambiata. */
export const CHANGE_MIN = 10;
/** Una mossa è accettata solo se tutte le sue case cambiano almeno così… */
export const MOVE_MIN = 16;
/** …e nettamente più della seconda mossa candidata. */
export const MOVE_RATIO = 1.6;

/**
 * Coordinate (u, v nel quadrato unitario della scacchiera) dei punti da
 * campionare per la cella (i, j): la parte centrale della casa, dove sta la
 * base del pezzo, lontano dai bordi e dalle teste dei pezzi vicini.
 */
export function samplePoints(i: number, j: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < SAMPLES_PER_SIDE; a++) {
    for (let b = 0; b < SAMPLES_PER_SIDE; b++) {
      const u = (j + 0.3 + (0.4 * b) / (SAMPLES_PER_SIDE - 1)) / 8;
      const v = (i + 0.3 + (0.4 * a) / (SAMPLES_PER_SIDE - 1)) / 8;
      out.push([u, v]);
    }
  }
  return out;
}

/**
 * Differenza media per cella (64 valori, cella i*8+j) tra due campionamenti.
 * Si toglie lo spostamento medio di ogni canale: l'esposizione automatica
 * cambia la luminosità di tutta l'immagine, non di una casa.
 */
export function cellChanges(before: Float32Array, after: Float32Array): Float32Array {
  const out = new Float32Array(64);
  if (before.length !== after.length || before.length !== 64 * VALUES_PER_CELL) return out.fill(255);
  const shift = [0, 0, 0];
  for (let k = 0; k < before.length; k++) shift[k % 3]! += after[k]! - before[k]!;
  const n = before.length / 3;
  for (let c = 0; c < 3; c++) shift[c] = shift[c]! / n;
  for (let cell = 0; cell < 64; cell++) {
    let sum = 0;
    for (let k = cell * VALUES_PER_CELL; k < (cell + 1) * VALUES_PER_CELL; k++) {
      sum += Math.abs(after[k]! - before[k]! - shift[k % 3]!);
    }
    out[cell] = sum / VALUES_PER_CELL;
  }
  return out;
}

/** Dalle celle della foto alle case della scacchiera. */
export function changesBySquare(cells: Float32Array, view: BoardView): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) out.set(cellToSquare(i, j, view), cells[i * 8 + j] ?? 0);
  }
  return out;
}

/** Case toccate da una mossa. */
function touchedSquares(move: Move): string[] {
  const squares: string[] = [move.from, move.to];
  if (move.isKingsideCastle()) squares.push(move.color === 'w' ? 'h1' : 'h8', move.color === 'w' ? 'f1' : 'f8');
  if (move.isQueensideCastle()) squares.push(move.color === 'w' ? 'a1' : 'a8', move.color === 'w' ? 'd1' : 'd8');
  if (move.isEnPassant()) squares.push(`${move.to[0]}${move.from[1]}`);
  return squares;
}

export type LocalMoveResult =
  | { kind: 'none' }
  | { kind: 'move'; uci: Uci; san: string; fen: string; score: number }
  | { kind: 'unsure'; reason: 'ambiguous' | 'weak' | 'other-changes' };

/**
 * Cerca la mossa legale che spiega le case cambiate. Ogni mossa riceve un
 * punteggio: quanto cambiano le SUE case (il minimo: devono cambiare tutte)
 * meno quanto cambia la casa più mossa FUORI da essa. Così l'arrocco batte
 * «Rf1» (che lascerebbero inspiegate h1 e g1) e un pezzo urtato fa scattare
 * la verifica con Claude.
 */
export function inferMove(fen: string, changes: Map<string, number>): LocalMoveResult {
  const values = [...changes.values()];
  const strongest = Math.max(0, ...values);
  if (strongest < CHANGE_MIN) return { kind: 'none' };
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { kind: 'unsure', reason: 'other-changes' };
  }
  const ordered = [...changes].sort((a, b) => b[1] - a[1]);
  const byKey = new Map<string, { move: Move; touchedMin: number; quality: number }>();
  for (const move of chess.moves({ verbose: true })) {
    const key = `${move.from}${move.to}`;
    // Promozione: le quattro scelte toccano le stesse case; si tiene la donna.
    if (byKey.has(key) && move.promotion !== 'q') continue;
    const touched = new Set(touchedSquares(move));
    const touchedMin = Math.min(...[...touched].map((sq) => changes.get(sq) ?? 0));
    const residual = ordered.find(([sq]) => !touched.has(sq))?.[1] ?? 0;
    byKey.set(key, { move, touchedMin, quality: touchedMin - residual });
  }
  const ranked = [...byKey.values()].sort((a, b) => b.quality - a.quality);
  const best = ranked[0];
  if (!best || best.touchedMin < MOVE_MIN) return { kind: 'unsure', reason: 'weak' };
  // Qualcosa di estraneo alla mossa cambia quanto (o più di) le sue case: pezzo urtato, mano in vista…
  if (best.quality < MOVE_MIN / 2) return { kind: 'unsure', reason: 'other-changes' };
  const second = Math.max(0, ranked[1]?.quality ?? 0);
  if (best.quality < MOVE_RATIO * second) return { kind: 'unsure', reason: 'ambiguous' };
  chess.move(best.move);
  return { kind: 'move', uci: `${best.move.from}${best.move.to}${best.move.promotion ?? ''}`, san: best.move.san, fen: chess.fen(), score: best.quality };
}
