import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { t } from '../../i18n';
import type { GameMove } from '../games/pgn';

/**
 * Istruzione e spiegazione di una mossa della partita, senza servizi esterni.
 *
 * - `instruction`: quale pezzo muovere e dove («Il Bianco muove il cavallo da g1 a f3»).
 * - `reasonOf`: perché si gioca. Se il PGN ha un commento si usa quello; altrimenti
 *   una spiegazione ricavata dalla posizione (cattura, scacco, sviluppo, minacce…).
 *   Con la chiave API la sostituisce la spiegazione di Claude.
 */

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function articled(piece: string): string {
  return piece === 'alfiere' ? `l’${piece}` : piece === 'pedone' || piece === 'cavallo' || piece === 're' ? `il ${piece}` : `la ${piece}`;
}

function play(fenBefore: string, move: GameMove): { chess: Chess; played: Move } | null {
  const chess = new Chess(fenBefore);
  try {
    const played = chess.move({ from: move.from, to: move.to, promotion: move.uci[4] ?? 'q' });
    return { chess, played };
  } catch {
    return null;
  }
}

/** «Il Bianco muove il cavallo da g1 a f3», «Il Nero cattura in d4 con il pedone che parte da e5», arrocchi, promozioni. */
export function instruction(fenBefore: string, move: GameMove): string {
  const result = play(fenBefore, move);
  const side = move.color === 'w' ? t.sides.w : t.sides.b;
  if (!result) return `${side}: ${move.san}`;
  const { played } = result;
  if (played.isKingsideCastle()) return t.moves.castleShort(side);
  if (played.isQueensideCastle()) return t.moves.castleLong(side);
  const piece = t.pieces[played.piece];
  const base = played.captured ? t.moves.capture(side, piece, played.from, played.to) : t.moves.quiet(side, piece, played.from, played.to);
  return played.promotion ? `${base.slice(0, -1)} e promuove a ${t.pieces[played.promotion]}.` : base;
}

/** Pezzi avversari attaccati dal pezzo appena mosso, dal più prezioso. */
function attackedBy(chess: Chess, square: Square): { piece: PieceSymbol; square: Square; defended: boolean }[] {
  const parts = chess.fen().split(' ');
  // Si guarda la posizione «come se toccasse di nuovo» a chi ha mosso.
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  let probe: Chess;
  try {
    probe = new Chess(parts.join(' '), { skipValidation: true });
  } catch {
    return [];
  }
  let moves: Move[];
  try {
    moves = probe.moves({ square, verbose: true });
  } catch {
    return [];
  }
  return moves
    .filter((m) => m.captured && m.captured !== 'k')
    .map((m) => ({ piece: m.captured!, square: m.to, defended: chess.isAttacked(m.to, chess.turn()) }))
    .sort((a, b) => VALUE[b.piece] - VALUE[a.piece]);
}

/** Perché si gioca la mossa: commento del PGN, oppure spiegazione dalla posizione (1–2 frasi). */
export function reasonOf(fenBefore: string, move: GameMove, previous?: GameMove): string {
  if (move.comment) return move.comment;
  const result = play(fenBefore, move);
  if (!result) return '';
  const { chess, played } = result;
  const r = t.gameTutor.reasons;
  const piece = t.pieces[played.piece];
  const reasons: string[] = [];

  if (chess.isCheckmate()) return r.mate;
  if (played.isKingsideCastle() || played.isQueensideCastle()) reasons.push(r.castle);
  else if (played.promotion) reasons.push(r.promote(t.pieces[played.promotion]));
  else if (played.captured) {
    const recapture = previous?.to === played.to && previous.san.includes('x');
    reasons.push(recapture ? r.recapture(articled(t.pieces[played.captured])) : r.capture(articled(t.pieces[played.captured]), played.to));
  }
  if (chess.isCheck()) reasons.push(r.check);

  if (reasons.length < 2 && !played.isKingsideCastle() && !played.isQueensideCastle()) {
    const target = attackedBy(chess, played.to).find((a) => !a.defended || VALUE[a.piece] > VALUE[played.piece]);
    if (target) reasons.push(r.attack(articled(t.pieces[target.piece]), target.square));
  }

  if (reasons.length === 0) {
    const opening = move.ply <= 30;
    const home = move.color === 'w' ? '1' : '8';
    const central = ['d4', 'e4', 'd5', 'e5', 'c4', 'c5', 'f4', 'f5'];
    if (opening && (played.piece === 'n' || played.piece === 'b') && played.from[1] === home) reasons.push(r.develop(articled(piece)));
    else if (opening && played.piece === 'p' && central.includes(played.to)) reasons.push(r.center);
    else if (played.piece === 'k' && countPieces(chess) <= 12) reasons.push(r.activeKing);
    else if (played.piece === 'p' && isPassed(chess, played.to, move.color)) reasons.push(r.passed);
    else if (played.piece === 'r' && openFile(chess, played.to[0]!)) reasons.push(r.openFile);
    else reasons.push(r.improve(articled(piece)));
  }
  return reasons.join(' ');
}

function countPieces(chess: Chess): number {
  return chess.board().flat().filter(Boolean).length;
}

function openFile(chess: Chess, file: string): boolean {
  return chess
    .board()
    .flat()
    .every((sq) => !sq || sq.type !== 'p' || sq.square[0] !== file);
}

function isPassed(chess: Chess, square: Square, color: 'w' | 'b'): boolean {
  const file = square.charCodeAt(0);
  const rank = Number(square[1]);
  return chess
    .board()
    .flat()
    .every((sq) => {
      if (!sq || sq.type !== 'p' || sq.color === color) return true;
      const f = sq.square.charCodeAt(0);
      const rr = Number(sq.square[1]);
      const ahead = color === 'w' ? rr > rank : rr < rank;
      return Math.abs(f - file) > 1 || !ahead;
    });
}
