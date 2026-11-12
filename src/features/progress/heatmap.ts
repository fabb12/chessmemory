import type { PieceSymbol } from 'chess.js';
import type { AttemptRecord } from '../../db/schema';
import { findExercise } from '../../data/exercises';
import type { Category, Exercise } from '../../types';
import { fenAtStep, parseUci, pieceAt } from '../../utils/chess';

/**
 * Mappa degli errori sulla scacchiera.
 *
 * - `wrong`: case di arrivo delle mosse errate che hai giocato
 *   (registrate dalla versione che ha introdotto la mappa in poi).
 * - `missed`: case di arrivo delle mosse giuste che ti sono sfuggite, cioè
 *   negli esercizi risolti con errori, indizi o non risolti. Si ricava dalla
 *   cronologia, quindi funziona anche con i dati già salvati.
 */
export type HeatMode = 'wrong' | 'missed';
export type HeatFilter = Category | 'all';

export interface HeatSquare {
  square: string;
  count: number;
}

export interface Heatmap {
  /** Conteggio per casa (solo le case con almeno un evento). */
  counts: Record<string, number>;
  max: number;
  total: number;
  /** Case più colpite, in ordine decrescente. */
  top: HeatSquare[];
  /** Pezzo coinvolto più spesso. */
  topPiece: { type: PieceSymbol; count: number } | null;
  /** Quota degli eventi sul lato di re (colonne e–h), 0–1. */
  kingside: number;
  /** Quota degli eventi nel centro allargato (c3–f6), 0–1. */
  center: number;
}

const TASK_ACTIVITIES = new Set(['recall', 'transfer']);

function inCenter(square: string): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return file >= 2 && file <= 5 && rank >= 3 && rank <= 6;
}

/** Un esercizio con difficoltà: errori, indizi o soluzione mostrata. */
function struggled(a: AttemptRecord, exercise: Exercise): boolean {
  return !a.correct || a.hintsUsed > 0 || a.attempts > exercise.solution.length || (a.wrongMoves?.length ?? 0) > 0;
}

function safePiece(exercise: Exercise, step: number, square: string): PieceSymbol | null {
  try {
    return pieceAt(fenAtStep(exercise, step), square)?.type ?? null;
  } catch {
    return null;
  }
}

export function computeHeatmap(
  attempts: readonly AttemptRecord[],
  mode: HeatMode,
  filter: HeatFilter = 'all',
  lookup: (id: string) => Exercise | undefined = findExercise,
): Heatmap {
  const counts: Record<string, number> = {};
  const pieces = new Map<PieceSymbol, number>();

  const add = (exercise: Exercise, step: number, uci: string) => {
    let from: string;
    let to: string;
    try {
      ({ from, to } = parseUci(uci));
    } catch {
      return;
    }
    counts[to] = (counts[to] ?? 0) + 1;
    const piece = safePiece(exercise, step, from);
    if (piece) pieces.set(piece, (pieces.get(piece) ?? 0) + 1);
  };

  for (const a of attempts) {
    if (!TASK_ACTIVITIES.has(a.activity)) continue;
    if (filter !== 'all' && a.category !== filter) continue;
    const exercise = lookup(a.exerciseId);
    if (!exercise) continue;

    if (mode === 'wrong') {
      for (const w of a.wrongMoves ?? []) add(exercise, w.step, w.move);
    } else if (struggled(a, exercise)) {
      // Senza il dettaglio dei passi si considera la mossa chiave (il primo passo);
      // con il dettaglio, ogni passo in cui c'è stato un errore.
      const steps = new Set((a.wrongMoves ?? []).map((w) => w.step));
      if (steps.size === 0) steps.add(0);
      for (const step of steps) {
        const s = exercise.solution[step];
        if (s) add(exercise, step, s.move);
      }
    }
  }

  const entries = Object.entries(counts).map(([square, count]) => ({ square, count }));
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const max = entries.reduce((m, e) => Math.max(m, e.count), 0);
  const top = [...entries].sort((x, y) => y.count - x.count || x.square.localeCompare(y.square)).slice(0, 3);
  const king = entries.filter((e) => e.square.charCodeAt(0) >= 101).reduce((s, e) => s + e.count, 0);
  const center = entries.filter((e) => inCenter(e.square)).reduce((s, e) => s + e.count, 0);

  let topPiece: Heatmap['topPiece'] = null;
  for (const [type, count] of pieces) {
    if (!topPiece || count > topPiece.count) topPiece = { type, count };
  }

  return {
    counts,
    max,
    total,
    top,
    topPiece,
    kingside: total ? king / total : 0,
    center: total ? center / total : 0,
  };
}
