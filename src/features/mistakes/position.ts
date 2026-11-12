import { Chess, validateFen } from 'chess.js';
import type { Side } from '../../types';

/**
 * Posizione dell'editor: disposizione libera dei pezzi più le informazioni
 * necessarie a costruire una FEN valida. chess.js resta l'unico giudice
 * della legalità.
 */

/** Pezzo nel formato di react-chessboard: colore + tipo maiuscolo, es. "wK", "bP". */
export type PieceCode = `${'w' | 'b'}${'K' | 'Q' | 'R' | 'B' | 'N' | 'P'}`;

export const PIECE_CODES: readonly PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

export type CastlingRight = 'K' | 'Q' | 'k' | 'q';
export const CASTLING_RIGHTS: readonly CastlingRight[] = ['K', 'Q', 'k', 'q'];

export interface EditorPosition {
  placement: Partial<Record<string, PieceCode>>;
  turn: Side;
  castling: CastlingRight[];
}

const FILES = 'abcdefgh';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function emptyPosition(turn: Side = 'w'): EditorPosition {
  return { placement: {}, turn, castling: [] };
}

export function startPosition(): EditorPosition {
  return fenToPosition(START_FEN) ?? emptyPosition();
}

function fenChar(code: PieceCode): string {
  const type = code[1] as string;
  return code[0] === 'w' ? type.toUpperCase() : type.toLowerCase();
}

function codeFromChar(ch: string): PieceCode | null {
  const upper = ch.toUpperCase();
  if (!'KQRBNP'.includes(upper)) return null;
  return `${ch === upper ? 'w' : 'b'}${upper}` as PieceCode;
}

export function placementToFen(placement: EditorPosition['placement']): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const file of FILES) {
      const code = placement[`${file}${rank}`];
      if (!code) {
        empty += 1;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      row += fenChar(code);
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

/** Diritti di arrocco compatibili con la posizione dei pezzi (re e torre sulle case iniziali). */
export function possibleCastling(placement: EditorPosition['placement']): CastlingRight[] {
  const out: CastlingRight[] = [];
  if (placement.e1 === 'wK') {
    if (placement.h1 === 'wR') out.push('K');
    if (placement.a1 === 'wR') out.push('Q');
  }
  if (placement.e8 === 'bK') {
    if (placement.h8 === 'bR') out.push('k');
    if (placement.a8 === 'bR') out.push('q');
  }
  return out;
}

export function positionToFen(position: EditorPosition): string {
  const allowed = possibleCastling(position.placement);
  const castling = CASTLING_RIGHTS.filter((c) => position.castling.includes(c) && allowed.includes(c)).join('') || '-';
  return `${placementToFen(position.placement)} ${position.turn} ${castling} - 0 1`;
}

/** Legge una FEN (anche solo la disposizione dei pezzi). Restituisce null se non è leggibile. */
export function fenToPosition(fen: string): EditorPosition | null {
  const fields = fen.trim().split(/\s+/);
  const board = fields[0];
  if (!board) return null;
  const rows = board.split('/');
  if (rows.length !== 8) return null;
  const placement: EditorPosition['placement'] = {};
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;
    let file = 0;
    for (const ch of rows[r] ?? '') {
      if (/[1-8]/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const code = codeFromChar(ch);
      if (!code || file > 7) return null;
      placement[`${FILES[file]}${rank}`] = code;
      file += 1;
    }
    if (file !== 8) return null;
  }
  const turn: Side = fields[1] === 'b' ? 'b' : 'w';
  const castlingField = fields[2] ?? '-';
  const castling = CASTLING_RIGHTS.filter((c) => castlingField.includes(c));
  return { placement, turn, castling };
}

export type PositionError = 'kings' | 'pawns' | 'check' | 'noMoves' | 'invalid';

/**
 * Controlla che la posizione si possa analizzare e giocare:
 * un re per parte, nessun pedone in prima/ottava traversa, il re di chi non
 * muove non sotto scacco, almeno una mossa legale per chi muove.
 */
export function validatePosition(position: EditorPosition): PositionError | null {
  const pieces = Object.entries(position.placement);
  const kings = (side: 'w' | 'b') => pieces.filter(([, c]) => c === `${side}K`).length;
  if (kings('w') !== 1 || kings('b') !== 1) return 'kings';
  if (pieces.some(([sq, c]) => c?.[1] === 'P' && (sq[1] === '1' || sq[1] === '8'))) return 'pawns';
  const fen = positionToFen(position);
  if (!validateFen(fen).ok) return 'invalid';
  // Se dopo aver passato il tratto all'altro colore c'è scacco, il re di chi
  // non muove sarebbe catturabile: posizione impossibile.
  const other = fen.replace(` ${position.turn} `, ` ${position.turn === 'w' ? 'b' : 'w'} `);
  try {
    if (new Chess(other, { skipValidation: true }).inCheck()) return 'check';
    const chess = new Chess(fen);
    if (chess.moves().length === 0) return 'noMoves';
  } catch {
    return 'invalid';
  }
  return null;
}
