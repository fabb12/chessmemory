import type { Uci } from '../../types';
import { applyUci } from '../../utils/chess';
import { terminalAnalysis, type Analyser, type Analysis } from '../engine/engine';
import { classifyMove, formatScore, scoreToCp, type Severity } from '../engine/uci';

/**
 * Valutazione della mossa che l'utente prova sulla scacchiera di «Analizza».
 * Serve ad allenarsi: prima si pensa, poi si confronta con Stockfish.
 */

export type MoveGrade = 'best' | 'good' | Severity;

export interface MoveFeedback {
  uci: Uci;
  san: string;
  grade: MoveGrade;
  /** Posizione (1–3) tra le mosse migliori di Stockfish, se ne fa parte. */
  rank: number | null;
  /** Centipedoni persi rispetto alla mossa migliore (0 se è la migliore). */
  lossCp: number;
  /** Valutazione dopo la mossa, dal punto di vista del Bianco (es. «+0,35»). */
  evaluation: string;
  bestUci: Uci;
}

/** Giudizio dalla perdita di probabilità di vittoria (stessa scala dell'analisi delle partite). */
export function gradeMove(bestCp: number, playedCp: number, rank: number | null): MoveGrade {
  if (rank === 1) return 'best';
  const severity = classifyMove(bestCp, playedCp);
  return severity ?? 'good';
}

/**
 * Valuta una mossa legale nella posizione già analizzata. Se è tra le migliori
 * il punteggio è già noto; altrimenti Stockfish valuta la posizione risultante.
 * Restituisce null se la mossa non è legale.
 */
export async function judgeMove(
  analysis: Analysis,
  uci: Uci,
  engine: Analyser,
  depth: number,
): Promise<MoveFeedback | null> {
  const best = analysis.lines[0];
  const move = applyUci(analysis.fen, uci);
  if (!best || !move) return null;
  const whiteMoved = move.color === 'w';
  const index = analysis.lines.findIndex((line) => line.pv[0] === uci);
  let playedCp: number;
  let evaluation: string;
  if (index >= 0) {
    const line = analysis.lines[index]!;
    playedCp = scoreToCp(line.score);
    evaluation = formatScore(line.score, whiteMoved);
  } else {
    // Dopo la mossa tocca all'avversario: il suo punteggio va letto con il segno cambiato.
    const after = terminalAnalysis(move.fen) ?? (await engine.analyse(move.fen, { depth, multiPv: 1 }));
    playedCp = -scoreToCp(after.score);
    evaluation = formatScore(after.score, !whiteMoved);
  }
  const bestCp = scoreToCp(best.score);
  const rank = index >= 0 ? index + 1 : null;
  return {
    uci,
    san: move.san,
    grade: gradeMove(bestCp, playedCp, rank),
    rank,
    lossCp: Math.max(0, bestCp - playedCp),
    evaluation,
    bestUci: best.pv[0] ?? uci,
  };
}
