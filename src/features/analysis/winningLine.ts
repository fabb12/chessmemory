import type { EngineLine } from '../engine/uci';
import { applyUci, type AppliedMove } from '../../utils/chess';

/**
 * La continuazione da mostrare a chi deve muovere:
 *  - «mate»: c'è un matto forzato → tutta la sequenza fino al matto;
 *  - «check»: niente matto, ma la variante migliore porta a dare scacco → fino allo scacco;
 *  - «plan»: nessuno scacco in vista → le prime mosse della variante migliore.
 */
export interface WinningLine {
  kind: 'mate' | 'check' | 'plan';
  moves: AppliedMove[];
  /** Matto in N mosse (solo «mate»). */
  mateIn: number | null;
  /** Numero di mosse proprie fino allo scacco (solo «check»). */
  checkIn: number | null;
}

/** Semimosse entro cui cercare uno scacco nella variante migliore. */
const CHECK_HORIZON = 9;
const PLAN_PLIES = 6;

export function winningLine(fen: string, line: EngineLine | undefined): WinningLine | null {
  if (!line) return null;
  const moves: AppliedMove[] = [];
  let current = fen;
  for (const uci of line.pv) {
    const move = applyUci(current, uci);
    if (!move) break;
    moves.push(move);
    current = move.fen;
    if (move.isCheckmate) break;
  }
  const first = moves[0];
  if (!first) return null;
  if (line.score.kind === 'mate' && line.score.value > 0) {
    return { kind: 'mate', moves, mateIn: line.score.value, checkIn: null };
  }
  const index = moves.findIndex((m, i) => i < CHECK_HORIZON && m.color === first.color && m.isCheck);
  if (index >= 0) return { kind: 'check', moves: moves.slice(0, index + 1), mateIn: null, checkIn: Math.floor(index / 2) + 1 };
  return { kind: 'plan', moves: moves.slice(0, PLAN_PLIES), mateIn: null, checkIn: null };
}
