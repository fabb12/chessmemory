import { t } from '../../i18n';
import type { Side } from '../../types';
import type { AppliedMove } from '../../utils/chess';
import { pieceAt } from '../../utils/chess';
import { sanToLocal } from '../../utils/notation';
import type { MoveGrade } from '../analysis/moveCoach';
import type { Tone } from '../tutor/tone';
import { ROBOT_TONES } from './robotTone';

/**
 * Benbot, il robot avversario: le sue battute e la sua espressione in risposta a
 * quello che succede sulla scacchiera. Solo logica, niente interfaccia.
 */

export type RobotMood = 'idle' | 'thinking' | 'happy' | 'wow' | 'worried' | 'sad';

export interface RobotLine {
  text: string;
  mood: RobotMood;
}

const r = t.play.robot;

/** Le battute nel tono scelto: quelle che il tono non ridefinisce restano normali. */
const toned = (tone: Tone) => ROBOT_TONES[tone] ?? {};

/** Sceglie una battuta in modo ripetibile: lo stesso `seed` dà la stessa frase. */
export function pick(list: readonly string[], seed: number): string {
  return list[Math.abs(Math.trunc(seed)) % list.length] ?? '';
}

function articled(piece: string): string {
  return piece === 'alfiere' ? `l’${piece}` : piece === 'pedone' || piece === 'cavallo' || piece === 're' ? `il ${piece}` : `la ${piece}`;
}

export function greeting(userColor: Side, tutor: boolean, tone: Tone = 'normal'): RobotLine {
  return { text: [(toned(tone).greeting ?? r.greeting)(userColor === 'w'), tutor ? r.tutorOnNote : ''].filter(Boolean).join(' '), mood: 'happy' };
}

/** Benbot si presenta e chiede come ti chiami. */
export function askNameLine(tone: Tone = 'normal'): RobotLine {
  return { text: toned(tone).askName ?? r.askName, mood: 'happy' };
}

/** Saluto con il tuo nome: `met` = te lo sei appena presentato, altrimenti se lo ricordava. */
export function greetByName(name: string, userColor: Side, tutor: boolean, met: boolean, tone: Tone = 'normal'): RobotLine {
  const line = (toned(tone).greetName ?? r.greetName)(name, userColor === 'w', met);
  return { text: [line, tutor ? r.tutorOnNote : ''].filter(Boolean).join(' '), mood: 'happy' };
}

/** Non ha capito il nome: lo richiede (o propone di scriverlo). */
export function nameRetryLine(): RobotLine {
  return { text: r.nameRetry, mood: 'worried' };
}

const GRADE_MOOD: Record<MoveGrade, RobotMood> = { best: 'wow', good: 'happy', inaccuracy: 'worried', mistake: 'worried', blunder: 'sad' };

/** Commento al giudizio del tutor sulla tua mossa. */
export function reactToGrade(grade: MoveGrade, seed: number, tone: Tone = 'normal'): RobotLine {
  return { text: pick(toned(tone).grade?.[grade] ?? r.grade[grade] ?? [], seed), mood: GRADE_MOOD[grade] ?? 'idle' };
}

/**
 * Reazione «a caldo» alla tua mossa, senza analisi: catture, scacchi, arrocco,
 * promozione. Null se la mossa non ha nulla di speciale.
 */
export function reactToUserMove(fenBefore: string, move: AppliedMove, seed: number, tone: Tone = 'normal'): RobotLine | null {
  const l = toned(tone);
  if (move.isCheckmate) return null; // ne parla la battuta di fine partita
  if (move.isCapture) {
    const square = move.isEnPassant ? `${move.to[0]}${move.from[1]}` : move.to;
    const captured = pieceAt(fenBefore, square);
    if (captured?.type === 'q') return { text: pick(l.lostQueen ?? r.lostQueen, seed), mood: 'sad' };
    const name = captured ? articled(t.pieces[captured.type]) : 'un pezzo';
    return { text: pick((l.lostPiece ?? r.lostPiece)(name), seed), mood: captured?.type === 'p' ? 'worried' : 'sad' };
  }
  if (move.isCheck) return { text: pick(l.inCheck ?? r.inCheck, seed), mood: 'worried' };
  if (move.isPromotion) return { text: pick(r.promoted, seed), mood: 'wow' };
  if (move.isCastle) return { text: pick(r.castled, seed), mood: 'happy' };
  return null;
}

/** Benbot annuncia la propria mossa (senza spiegarla: quello lo fa il tutor). */
export function announceOwnMove(move: AppliedMove, seed: number, tone: Tone = 'normal'): RobotLine {
  const parts = [r.iPlay(sanToLocal(move.san))];
  if (move.isCheckmate) return { text: parts[0]!, mood: 'happy' };
  if (move.isCheck) parts.push(pick(r.iCheck, seed));
  else if (move.isCapture) parts.push(pick(toned(tone).iCapture ?? r.iCapture, seed));
  return { text: parts.join(' '), mood: move.isCheck || move.isCapture ? 'happy' : 'idle' };
}

export function outcomeLine(outcome: 'win' | 'loss' | 'draw' | 'resigned', tone: Tone = 'normal'): RobotLine {
  const mood: RobotMood = outcome === 'win' ? 'wow' : outcome === 'loss' ? 'happy' : outcome === 'draw' ? 'idle' : 'sad';
  return { text: toned(tone).outcome?.[outcome] ?? r.outcome[outcome] ?? '', mood };
}

export function hintLine(move: string, tone: Tone = 'normal'): RobotLine {
  return { text: (toned(tone).hint ?? r.hint)(move), mood: 'happy' };
}

export function undoLine(seed: number, tone: Tone = 'normal'): RobotLine {
  return { text: pick(toned(tone).undo ?? r.undo, seed), mood: 'idle' };
}

export function engineErrorLine(): RobotLine {
  return { text: r.engineError, mood: 'sad' };
}

/** Frase mostrata nel fumetto quando Benbot non ha detto nulla in questo turno. */
export function idleLine(thinking: boolean, seed: number, tone: Tone = 'normal'): string {
  const l = toned(tone);
  return pick(thinking ? (l.thinking ?? r.thinking) : (l.yourTurn ?? r.yourTurn), seed);
}
