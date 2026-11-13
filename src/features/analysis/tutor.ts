import type { Side, Uci } from '../../types';
import { applyUci, pieceAt } from '../../utils/chess';
import { sanToLocal } from '../../utils/notation';
import type { Analysis } from '../engine/engine';
import { scoreToCp } from '../engine/uci';
import { gradeMove, type MoveGrade } from './moveCoach';
import { winningLine } from './winningLine';

/**
 * Le frasi del tutor, costruite sul dispositivo a partire dall'analisi di
 * Stockfish: nessuna chiamata a Claude e nessun token. Una frase per ogni
 * nuova posizione, pensata per essere letta ad alta voce.
 */

export interface TutorMove {
  /** Mossa in notazione SAN (inglese, come la produce chess.js). */
  san: string;
  color: Side;
}

export interface TutorInput {
  fen: string;
  analysis: Analysis;
  myColor: Side;
  /** Mossa che ha portato a questa posizione, se nota. */
  lastMove: TutorMove | null;
  /** Analisi della posizione prima di `lastMove` (per giudicare la propria mossa). */
  previous: Analysis | null;
  /** Allenamento «prima prova tu»: non si dice la mossa migliore. */
  hideBest?: boolean;
}

const SIDE = { w: 'il Bianco', b: 'il Nero' } as const;
const CAPTURED: Record<string, string> = { p: 'il pedone', n: 'il cavallo', b: 'l’alfiere', r: 'la torre', q: 'la donna' };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Giudizio sulla mossa appena giocata, confrontata con la migliore della posizione precedente. */
export function gradeLastMove(previous: Analysis, san: string, after: Analysis): { grade: MoveGrade; bestSan: string } | null {
  const best = previous.lines[0];
  if (!best) return null;
  const sans = previous.lines.map((line) => (line.pv[0] ? applyUci(previous.fen, line.pv[0])?.san : undefined));
  const bestSan = sans[0];
  if (!bestSan) return null;
  const index = sans.indexOf(san);
  // Dopo la mossa il punteggio è dal punto di vista dell'avversario: si cambia il segno.
  const playedCp = index >= 0 ? scoreToCp(previous.lines[index]!.score) : -scoreToCp(after.score);
  return { grade: gradeMove(scoreToCp(best.score), playedCp, index >= 0 ? index + 1 : null), bestSan };
}

/** Che cosa ottiene la mossa: matto, presa, scacco. */
function moveReason(fen: string, uci: Uci): string {
  const move = applyUci(fen, uci);
  if (!move) return '';
  if (move.isCheckmate) return ', ed è scacco matto';
  const captured = pieceAt(fen, move.isEnPassant ? `${move.to[0]}${move.from[1]}` : move.to);
  if (captured && move.isCapture) return `: prendi ${CAPTURED[captured.type] ?? 'un pezzo'}`;
  if (move.isCheck) return ', dando scacco';
  return '';
}

export function tutorSpeech({ fen, analysis, myColor, lastMove, previous, hideBest = false }: TutorInput): string {
  const parts: string[] = [];
  if (lastMove) {
    if (lastMove.color === myColor && previous) {
      const judged = gradeLastMove(previous, lastMove.san, analysis);
      if (judged) {
        const best = sanToLocal(judged.bestSan);
        parts.push(
          judged.grade === 'best'
            ? 'Ottima mossa!'
            : judged.grade === 'good'
              ? 'Buona mossa.'
              : judged.grade === 'inaccuracy'
                ? `Imprecisione: era meglio ${best}.`
                : judged.grade === 'mistake'
                  ? `Errore: era meglio ${best}.`
                  : `Attenzione, grave errore: era meglio ${best}.`,
        );
      }
    } else if (lastMove.color !== myColor) {
      parts.push(`${capitalize(SIDE[lastMove.color])} ha giocato ${sanToLocal(lastMove.san)}.`);
    }
  }

  const turn = (fen.split(' ')[1] === 'b' ? 'b' : 'w') as Side;
  const line = analysis.lines[0];
  if (!line) {
    parts.push(analysis.score.kind === 'mate' ? 'Scacco matto: la partita è finita.' : 'La partita è finita in parità.');
    return parts.join(' ');
  }
  const first = line.pv[0];
  const firstMove = first ? applyUci(fen, first) : null;

  if (turn === myColor) {
    if (hideBest || !firstMove) {
      parts.push('Tocca a te: qual è la mossa migliore?');
    } else {
      const win = winningLine(fen, line);
      let text = `Tocca a te: ti consiglio ${sanToLocal(firstMove.san)}${moveReason(fen, first!)}.`;
      if (win?.kind === 'mate' && (win.mateIn ?? 0) > 1) text += ` C'è un matto in ${win.mateIn}!`;
      parts.push(text);
    }
  } else {
    parts.push('Tocca all’avversario.');
    if (firstMove) {
      const cp = scoreToCp(line.score);
      if (line.score.kind === 'mate' && line.score.value > 0) {
        parts.push(`Attenzione: minaccia matto con ${sanToLocal(firstMove.san)}.`);
      } else if (firstMove.isCapture && cp >= 150) {
        parts.push(`Attenzione: può giocare ${sanToLocal(firstMove.san)}.`);
      }
    }
  }
  return parts.join(' ');
}
