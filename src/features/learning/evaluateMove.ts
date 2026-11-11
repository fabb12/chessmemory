import type { Exercise, Uci } from '../../types';
import { applyUci, fenAtStep } from '../../utils/chess';

export type MoveVerdict =
  /** Mossa preferita. */
  | 'best'
  /** Alternativa esplicitamente accettata nel dataset. */
  | 'alternative'
  /** Mossa legale ma non accettata. */
  | 'wrong'
  /** Mossa non legale nella posizione. */
  | 'illegal';

export function isAccepted(verdict: MoveVerdict): boolean {
  return verdict === 'best' || verdict === 'alternative';
}

/** Valuta la mossa dell'utente per il passo indicato della soluzione. */
export function evaluateMove(exercise: Exercise, stepIndex: number, uci: Uci): MoveVerdict {
  const step = exercise.solution[stepIndex];
  if (!step) return 'illegal';
  const fen = fenAtStep(exercise, stepIndex);
  if (!applyUci(fen, uci)) return 'illegal';
  if (uci === step.move) return 'best';
  if (step.alternatives?.includes(uci)) return 'alternative';
  return 'wrong';
}
