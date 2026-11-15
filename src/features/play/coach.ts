import type { Uci } from '../../types';
import { applyUci, pieceAt } from '../../utils/chess';
import { localSquares, sanToLocal } from '../../utils/notation';
import { t } from '../../i18n';
import type { Analysis } from '../engine/engine';
import { scoreToCp } from '../engine/uci';
import { gradeLastMove } from '../analysis/tutor';
import type { MoveGrade } from '../analysis/moveCoach';
import type { GameMove } from '../games/pgn';
import { reasonOf } from '../tutor/moveReason';

/**
 * Le spiegazioni della modalità tutor nella partita contro l'AI, costruite
 * sul dispositivo a partire dall'analisi di Stockfish (nessun servizio esterno):
 *  - perché l'AI ha giocato la sua mossa;
 *  - se la tua mossa è buona, e se no perché è sbagliata e che cosa era meglio.
 */

const p = t.play.coach;
/** SAN con le iniziali italiane; le case si girano una volta sola, alla fine, con localSquares. */
const san = (s: string) => sanToLocal(s, false);

function toGameMove(fenBefore: string, uci: Uci, ply: number): GameMove | null {
  const move = applyUci(fenBefore, uci);
  if (!move) return null;
  return {
    ply,
    moveNumber: Math.ceil(ply / 2),
    color: move.color,
    san: move.san,
    uci: move.uci,
    from: move.from,
    to: move.to,
    fen: move.fen,
  };
}

/** Numero di semimossa dal FEN (serve alle euristiche d'apertura). */
export function plyOf(fen: string): number {
  const parts = fen.split(' ');
  const full = Number(parts[5]) || 1;
  return (full - 1) * 2 + (parts[1] === 'b' ? 2 : 1);
}

function articled(piece: string): string {
  return piece === 'alfiere' ? `l’${piece}` : piece === 'pedone' || piece === 'cavallo' || piece === 're' ? `il ${piece}` : `la ${piece}`;
}

/** Perché si gioca una mossa (motivi concreti + principio), in testo leggibile. */
export function whyMove(fenBefore: string, uci: Uci, previous?: { fenBefore: string; uci: Uci }): string {
  const ply = plyOf(fenBefore);
  const move = toGameMove(fenBefore, uci, ply);
  if (!move) return '';
  const prev = previous ? toGameMove(previous.fenBefore, previous.uci, ply - 1) ?? undefined : undefined;
  return reasonOf(fenBefore, move, prev);
}

export interface AiMoveExplanation {
  san: string;
  text: string;
  /** L'AI ha sbagliato: c'è qualcosa da sfruttare (senza dire cosa). */
  opportunity: boolean;
}

/**
 * Spiega la mossa dell'AI. `aiAnalysis` è l'analisi usata dall'AI per scegliere,
 * `reply` (facoltativa) l'analisi più profonda della posizione in cui tocca a te.
 */
export function explainAiMove(
  fenBefore: string,
  uci: Uci,
  aiAnalysis: Analysis | null,
  reply: Analysis | null,
  previous?: { fenBefore: string; uci: Uci },
): AiMoveExplanation | null {
  const move = applyUci(fenBefore, uci);
  if (!move) return null;
  const parts = [p.aiPlayed(san(move.san)), whyMove(fenBefore, uci, previous)];
  let opportunity = false;
  const replyLine = reply?.lines[0];
  if (replyLine) {
    if (replyLine.score.kind === 'mate' && replyLine.score.value < 0) {
      parts.push(p.mateThreat);
    } else if (aiAnalysis?.lines[0] && !move.isCheckmate) {
      // Quanto ha perso l'AI rispetto alla sua mossa migliore (dal suo punto di vista).
      const aiBest = scoreToCp(aiAnalysis.lines[0].score);
      const aiAfter = -scoreToCp(replyLine.score);
      if (aiBest - aiAfter >= 150) {
        parts.push(p.aiSlip);
        opportunity = true;
      }
    }
  }
  return { san: move.san, text: localSquares(parts.filter(Boolean).join(' ')), opportunity };
}

export interface UserMoveFeedback {
  grade: MoveGrade;
  san: string;
  /** Titolo breve: «Ottima mossa!», «Errore»… */
  title: string;
  /** Perché la mossa è buona, o perché è sbagliata. */
  why: string;
  /** Che cosa era meglio (solo per imprecisioni ed errori). */
  better: string | null;
  bestUci: Uci | null;
  /** Risposta dell'avversario che punisce la mossa (solo per gli errori). */
  refutationUci: Uci | null;
}

/**
 * Giudica la tua mossa. `before`: analisi della posizione prima della mossa
 * (meglio con più varianti), `after`: analisi della posizione dopo (tocca all'AI).
 */
export function explainUserMove(fenBefore: string, uci: Uci, before: Analysis, after: Analysis, previous?: { fenBefore: string; uci: Uci }): UserMoveFeedback | null {
  const move = applyUci(fenBefore, uci);
  if (!move) return null;
  const judged = gradeLastMove(before, move.san, after);
  if (!judged) return null;
  const { grade } = judged;
  const bestUci = before.lines[0]?.pv[0] ?? null;

  if (grade === 'best' || grade === 'good') {
    return {
      grade,
      san: move.san,
      title: grade === 'best' ? p.titles.best : p.titles.good,
      why: localSquares(whyMove(fenBefore, uci, previous)),
      better: null,
      bestUci,
      refutationUci: null,
    };
  }

  // Perché è sbagliata: la risposta migliore dell'avversario.
  const whyParts: string[] = [];
  const refLine = after.lines[0];
  const refUci = refLine?.pv[0] ?? null;
  const ref = refUci ? applyUci(after.fen, refUci) : null;
  if (ref && refLine) {
    if (refLine.score.kind === 'mate' && refLine.score.value > 0) {
      whyParts.push(p.allowsMate(refLine.score.value, san(ref.san)));
    } else if (ref.isCapture) {
      const square = ref.isEnPassant ? `${ref.to[0]}${ref.from[1]}` : ref.to;
      const captured = pieceAt(after.fen, square);
      const name = captured ? articled(t.pieces[captured.type]) : 'un pezzo';
      whyParts.push(ref.to === move.to ? p.hangsMoved(san(ref.san), name) : p.allowsCapture(san(ref.san), name, square));
    } else if (ref.isCheck) {
      whyParts.push(p.allowsCheck(san(ref.san)));
    } else {
      whyParts.push(p.allowsReply(san(ref.san), whyMove(after.fen, refUci!, { fenBefore, uci })));
    }
  }
  const best = before.lines[0];
  const playedIndex = before.lines.findIndex((l) => l.pv[0] === uci);
  const playedCp = playedIndex >= 0 ? scoreToCp(before.lines[playedIndex]!.score) : -scoreToCp(after.score);
  if (best && best.score.kind === 'cp' && after.score.kind === 'cp') {
    const loss = (scoreToCp(best.score) - playedCp) / 100;
    if (loss >= 0.5) whyParts.push(p.costs(loss.toFixed(1).replace('.', ',')));
  }

  let better: string | null = null;
  const bestMove = bestUci ? applyUci(fenBefore, bestUci) : null;
  if (bestMove && best) {
    const mateIn = best.score.kind === 'mate' && best.score.value > 1 ? best.score.value : null;
    better = mateIn ? p.hadMate(mateIn, san(bestMove.san)) : p.better(san(bestMove.san), whyMove(fenBefore, bestUci!, previous));
  }

  return {
    grade,
    san: move.san,
    title: p.titles[grade],
    why: localSquares(whyParts.join(' ')),
    better: better ? localSquares(better) : null,
    bestUci,
    refutationUci: refUci,
  };
}

/** Testo da leggere ad alta voce o da mostrare tutto insieme. */
export function feedbackText(f: UserMoveFeedback): string {
  return [f.title, f.why, f.better].filter(Boolean).join(' ');
}
