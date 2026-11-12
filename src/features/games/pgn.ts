import { Chess } from 'chess.js';
import { toUci } from '../../utils/chess';
import type { Side, Uci } from '../../types';

/** Una mossa di una partita, con la posizione che ne risulta. */
export interface GameMove {
  /** Numero di semimossa, da 1. */
  ply: number;
  /** Numero della mossa (1.e4 e5 → entrambe «1»). */
  moveNumber: number;
  color: Side;
  san: string;
  uci: Uci;
  from: string;
  to: string;
  /** Posizione dopo la mossa. */
  fen: string;
  comment?: string;
}

export interface ParsedGame {
  startFen: string;
  moves: GameMove[];
}

const MOVE_NUMBER = /^\d+\.(\.\.)?$/;
const RESULT = /^(1-0|0-1|1\/2-1\/2|\*)$/;

/**
 * Legge una partita in notazione SAN con commenti tra graffe
 * («1.e4 e5 {commento} 2.Nf3 …»). I simboli di valutazione (!, ?) restano
 * nella SAN mostrata ma vengono ignorati da chess.js. Lancia un errore
 * se una mossa è illegale.
 */
export function parseGame(pgn: string): ParsedGame {
  const chess = new Chess();
  const startFen = chess.fen();
  const moves: GameMove[] = [];
  const tokens = pgn.match(/\{[^}]*\}|[^\s{}]+/g) ?? [];

  for (const raw of tokens) {
    if (raw.startsWith('{')) {
      const text = raw.slice(1, -1).replace(/\s+/g, ' ').trim();
      const last = moves[moves.length - 1];
      if (last && text) last.comment = last.comment ? `${last.comment} ${text}` : text;
      continue;
    }
    // «12.O-O-O» oppure «12.» e poi la mossa: si separa il numero.
    const token = raw.replace(/^\d+\.(\.\.)?/, '');
    if (!token || MOVE_NUMBER.test(raw) || RESULT.test(token)) continue;
    let move;
    try {
      move = chess.move(token.replace(/[!?]+$/, ''));
    } catch {
      throw new Error(`Mossa illegale alla semimossa ${moves.length + 1}: ${token}`);
    }
    moves.push({
      ply: moves.length + 1,
      moveNumber: Math.floor(moves.length / 2) + 1,
      color: move.color,
      san: token,
      uci: toUci(move),
      from: move.from,
      to: move.to,
      fen: chess.fen(),
    });
  }
  return { startFen, moves };
}
