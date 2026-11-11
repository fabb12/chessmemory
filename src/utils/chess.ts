import { Chess, validateFen, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Exercise, Side, Uci } from '../types';

/**
 * Funzioni di supporto per le mosse. chess.js è l'unica fonte di verità per
 * le regole: qui non viene reimplementata alcuna logica di legalità.
 */

export interface ParsedUci {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function isUci(value: string): boolean {
  return UCI_RE.test(value);
}

export function parseUci(uci: Uci): ParsedUci {
  if (!isUci(uci)) throw new Error(`Mossa UCI non valida: ${uci}`);
  const promotion = uci.length === 5 ? (uci[4] as PieceSymbol) : undefined;
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    ...(promotion ? { promotion } : {}),
  };
}

export function toUci(move: Pick<Move, 'from' | 'to' | 'promotion'>): Uci {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok;
}

export interface AppliedMove {
  fen: string;
  uci: Uci;
  san: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  color: Side;
  isCapture: boolean;
  isCastle: boolean;
  isEnPassant: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
}

/** Applica una mossa UCI; restituisce null se la mossa è illegale. */
export function applyUci(fen: string, uci: Uci): AppliedMove | null {
  if (!isUci(uci)) return null;
  const chess = new Chess(fen);
  let move: Move;
  try {
    move = chess.move(parseUci(uci));
  } catch {
    return null;
  }
  return {
    fen: chess.fen(),
    uci: toUci(move),
    san: move.san,
    from: move.from,
    to: move.to,
    piece: move.piece,
    color: move.color,
    isCapture: move.isCapture() || move.isEnPassant(),
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
    isEnPassant: move.isEnPassant(),
    isPromotion: move.isPromotion(),
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
  };
}

export interface LegalTarget {
  to: Square;
  isCapture: boolean;
  isPromotion: boolean;
}

/** Case raggiungibili legalmente dal pezzo sulla casa indicata. */
export function legalTargets(fen: string, square: string): LegalTarget[] {
  const chess = new Chess(fen);
  let moves: Move[];
  try {
    moves = chess.moves({ square: square as Square, verbose: true });
  } catch {
    return [];
  }
  const byTarget = new Map<Square, LegalTarget>();
  for (const m of moves) {
    byTarget.set(m.to, {
      to: m.to,
      isCapture: m.isCapture() || m.isEnPassant(),
      isPromotion: m.isPromotion(),
    });
  }
  return [...byTarget.values()];
}

export function allLegalUci(fen: string): Uci[] {
  return new Chess(fen).moves({ verbose: true }).map(toUci);
}

export function sideToMove(fen: string): Side {
  return new Chess(fen).turn();
}

export interface PieceInfo {
  type: PieceSymbol;
  color: Side;
}

export function pieceAt(fen: string, square: string): PieceInfo | null {
  const p = new Chess(fen).get(square as Square);
  return p ? { type: p.type, color: p.color } : null;
}

export function kingSquareInCheck(fen: string): Square | null {
  const chess = new Chess(fen);
  if (!chess.isCheck()) return null;
  return chess.findPiece({ type: 'k', color: chess.turn() })[0] ?? null;
}

export interface LineFrame {
  fen: string;
  /** Mossa che ha portato a questa posizione (assente per la posizione iniziale). */
  move?: AppliedMove;
  /** true se la mossa è del giocatore che risolve l'esercizio. */
  byPlayer?: boolean;
}

/**
 * Tutte le posizioni della linea principale di un esercizio, comprese le
 * risposte avversarie. Lancia un errore se una mossa non è legale.
 */
export function solutionLine(exercise: Pick<Exercise, 'fen' | 'solution' | 'id'>): LineFrame[] {
  const frames: LineFrame[] = [{ fen: exercise.fen }];
  let fen = exercise.fen;
  for (const step of exercise.solution) {
    const played = applyUci(fen, step.move);
    if (!played) throw new Error(`${exercise.id}: mossa illegale ${step.move}`);
    frames.push({ fen: played.fen, move: played, byPlayer: true });
    fen = played.fen;
    if (step.reply) {
      const reply = applyUci(fen, step.reply);
      if (!reply) throw new Error(`${exercise.id}: risposta illegale ${step.reply}`);
      frames.push({ fen: reply.fen, move: reply, byPlayer: false });
      fen = reply.fen;
    }
  }
  return frames;
}

/** Posizione all'inizio del passo indicato (dopo le mosse e risposte precedenti). */
export function fenAtStep(exercise: Pick<Exercise, 'fen' | 'solution' | 'id'>, stepIndex: number): string {
  let fen = exercise.fen;
  for (let i = 0; i < stepIndex; i++) {
    const step = exercise.solution[i];
    if (!step) break;
    const played = applyUci(fen, step.move);
    if (!played) throw new Error(`${exercise.id}: mossa illegale ${step.move}`);
    fen = played.fen;
    if (step.reply) {
      const reply = applyUci(fen, step.reply);
      if (!reply) throw new Error(`${exercise.id}: risposta illegale ${step.reply}`);
      fen = reply.fen;
    }
  }
  return fen;
}
