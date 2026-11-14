import type { PieceSymbol } from 'chess.js';
import { t } from '../i18n';
import type { AppliedMove } from './chess';

const SAN_PIECES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };

/**
 * Numerazione invertita: scacchiere su cui il Nero sta sulle righe 1-2 (scacchiera girata
 * rispetto alle coordinate stampate). La posizione resta quella vera; cambiano solo i nomi
 * delle case mostrati e pronunciati: a1↔h8, b2↔g7… (la scacchiera è ruotata di 180°).
 * La imposta la pagina Analizza finché è aperta.
 */
let flippedSquares = false;

export function setFlippedSquares(on: boolean): void {
  flippedSquares = on;
}

export function squaresFlipped(): boolean {
  return flippedSquares;
}

const flipChar = (c: string): string =>
  c >= 'a' && c <= 'h' ? String.fromCharCode(201 - c.charCodeAt(0)) : c >= '1' && c <= '8' ? String(9 - Number(c)) : c;

/** Nome della casa con la numerazione invertita (a1 → h8). */
export function flipSquare(square: string): string {
  return square.replace(/[a-h1-8]/g, flipChar);
}

/** Mossa in notazione (anche italiana) con le case rinominate: colonne a-h e righe 1-8. */
function flipSan(san: string): string {
  return san.replace(/[a-h1-8]/g, flipChar);
}

const SAN_WORD = /^(?:[KQRBNRDTAC]?[a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBNRDTAC])?)$/;

/** Rinomina le case dentro un testo libero (es. la spiegazione di Claude), se la numerazione è invertita. */
export function localSquares(text: string, flip = flippedSquares): string {
  if (!flip) return text;
  return text.replace(/[A-Za-z0-9=]+/g, (word) => (SAN_WORD.test(word) ? flipSan(word) : word));
}

/** Converte la notazione SAN inglese nelle iniziali italiane (R, D, T, A, C). */
export function sanToLocal(san: string, flip = flippedSquares): string {
  if (san.startsWith('O-O')) return san;
  const local = san.replace(/[KQRBN]/g, (c) => SAN_PIECES[c] ?? c);
  return flip ? flipSan(local) : local;
}

export function pieceName(type: PieceSymbol): string {
  return t.pieces[type];
}

/** Frase «quale pezzo si muove» per la fase OSSERVA. */
export function describeMove(move: AppliedMove): string {
  const side = move.color === 'w' ? t.sides.w : t.sides.b;
  if (move.isCastle) {
    return move.san.startsWith('O-O-O') ? t.moves.castleLong(side) : t.moves.castleShort(side);
  }
  const piece = pieceName(move.piece);
  return move.isCapture
    ? t.moves.capture(side, piece, move.from, move.to)
    : t.moves.quiet(side, piece, move.from, move.to);
}

/** Variante leggibile, es. «1.b6 cxb6 2.a6» oppure «1…g3 2.hxg3 f3». */
export function formatLine(moves: readonly AppliedMove[], flip = flippedSquares): string {
  const parts: string[] = [];
  let number = 1;
  moves.forEach((move, index) => {
    const san = sanToLocal(move.san, flip);
    if (move.color === 'w') {
      parts.push(`${number}.${san}`);
    } else {
      parts.push(index === 0 ? `${number}…${san}` : san);
      number += 1;
    }
  });
  return parts.join(' ');
}
