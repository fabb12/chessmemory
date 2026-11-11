import type { PieceSymbol } from 'chess.js';
import { t } from '../i18n';
import type { AppliedMove } from './chess';

const SAN_PIECES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };

/** Converte la notazione SAN inglese nelle iniziali italiane (R, D, T, A, C). */
export function sanToLocal(san: string): string {
  if (san.startsWith('O-O')) return san;
  return san.replace(/[KQRBN]/g, (c) => SAN_PIECES[c] ?? c);
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
export function formatLine(moves: readonly AppliedMove[]): string {
  const parts: string[] = [];
  let number = 1;
  moves.forEach((move, index) => {
    const san = sanToLocal(move.san);
    if (move.color === 'w') {
      parts.push(`${number}.${san}`);
    } else {
      parts.push(index === 0 ? `${number}…${san}` : san);
      number += 1;
    }
  });
  return parts.join(' ');
}
