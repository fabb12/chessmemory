import { Chess } from 'chess.js';
import type { Side, Uci } from '../../types';
import { toUci } from '../../utils/chess';
import type { Analyser } from '../engine/engine';
import { classifyMove, negateScore, scoreToCp, type Score, type Severity } from '../engine/uci';

/** Una semimossa di una partita importata. */
export interface GameMove {
  /** Indice della semimossa, da 0. */
  ply: number;
  /** Numero di mossa come nella notazione (1, 1, 2, 2, …). */
  moveNumber: number;
  color: Side;
  /** Posizione prima della mossa. */
  fenBefore: string;
  fenAfter: string;
  uci: Uci;
  san: string;
}

export interface ParsedGame {
  headers: Record<string, string>;
  moves: GameMove[];
  /** Descrizione breve: «Bianco – Nero, data». */
  label: string;
}

export class PgnError extends Error {
  constructor(message = 'PGN non valido') {
    super(message);
    this.name = 'PgnError';
  }
}

export const MAX_PGN_LENGTH = 200_000;

/** Legge una partita in formato PGN (la prima, se il testo ne contiene più di una). */
export function parsePgn(text: string): ParsedGame {
  const trimmed = text.trim();
  if (!trimmed) throw new PgnError('Il testo è vuoto');
  if (trimmed.length > MAX_PGN_LENGTH) throw new PgnError('Il testo è troppo lungo');
  const first = splitPgnGames(trimmed)[0] ?? trimmed;
  const chess = new Chess();
  try {
    chess.loadPgn(first);
  } catch (error) {
    throw new PgnError(error instanceof Error ? error.message : 'PGN non valido');
  }
  const history = chess.history({ verbose: true });
  if (history.length === 0) throw new PgnError('La partita non contiene mosse');
  const headers = Object.fromEntries(
    Object.entries(chess.getHeaders()).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const moves: GameMove[] = history.map((move, ply) => ({
    ply,
    moveNumber: Number(move.before.split(' ')[5] ?? '1'),
    color: move.color,
    fenBefore: move.before,
    fenAfter: move.after,
    uci: toUci(move),
    san: move.san,
  }));
  return { headers, moves, label: gameLabel(headers) };
}

/** Divide un file PGN con più partite. */
export function splitPgnGames(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n(?=\[Event\s)/)
    .map((g) => g.trim())
    .filter(Boolean);
}

function clean(value: string | undefined): string | null {
  if (!value || value === '?' || /^\?+$/.test(value) || value.includes('??')) return null;
  return value.trim() || null;
}

export function gameLabel(headers: Record<string, string>): string {
  const white = clean(headers.White) ?? 'Bianco';
  const black = clean(headers.Black) ?? 'Nero';
  const date = clean(headers.UTCDate ?? headers.Date)?.replace(/\./g, '-');
  return date ? `${white} – ${black}, ${date}` : `${white} – ${black}`;
}

/** Colore del giocatore indicato, se il suo nome compare nelle intestazioni. */
export function detectPlayerColor(headers: Record<string, string>, playerName: string): Side | null {
  const name = playerName.trim().toLowerCase();
  if (!name) return null;
  if (headers.White?.trim().toLowerCase() === name) return 'w';
  if (headers.Black?.trim().toLowerCase() === name) return 'b';
  return null;
}

/** Un errore trovato dal motore in una partita. */
export interface GameMistake {
  move: GameMove;
  severity: Severity;
  /** Mossa migliore e variante principale nella posizione prima dell'errore. */
  bestMove: Uci;
  line: Uci[];
  /** Punteggi dal punto di vista di chi ha sbagliato. */
  bestScore: Score;
  playedScore: Score;
  depth: number;
}

export interface ScanProgress {
  done: number;
  total: number;
}

/**
 * Analizza le mosse di un giocatore e restituisce quelle che peggiorano
 * sensibilmente la sua posizione. Per ogni mossa servono due analisi: la
 * posizione prima (mossa migliore) e quella dopo (valore della mossa giocata).
 * Le posizioni sono condivise tra mosse consecutive, quindi ogni posizione è
 * analizzata una sola volta.
 */
export async function scanGameForMistakes(
  moves: readonly GameMove[],
  player: Side,
  analyser: Analyser,
  options: { depth: number; signal?: AbortSignal; onProgress?: (p: ScanProgress) => void },
): Promise<GameMistake[]> {
  const own = moves.filter((m) => m.color === player);
  const fens = [...new Set(own.flatMap((m) => [m.fenBefore, m.fenAfter]))];
  const scores = new Map<string, { score: Score; best: Uci | null; pv: Uci[]; depth: number }>();
  let done = 0;
  options.onProgress?.({ done, total: fens.length });
  for (const fen of fens) {
    if (options.signal?.aborted) throw new DOMException('Analisi interrotta', 'AbortError');
    const analysis = await analyser.analyse(fen, { depth: options.depth });
    scores.set(fen, {
      score: analysis.score,
      best: analysis.bestMove,
      pv: analysis.lines[0]?.pv ?? (analysis.bestMove ? [analysis.bestMove] : []),
      depth: analysis.depth,
    });
    done += 1;
    options.onProgress?.({ done, total: fens.length });
  }

  const found: GameMistake[] = [];
  for (const move of own) {
    const before = scores.get(move.fenBefore);
    const after = scores.get(move.fenAfter);
    if (!before || !after || !before.best || before.best === move.uci) continue;
    // Dopo la mossa muove l'avversario: il suo punteggio va invertito.
    const playedScore = negateScore(after.score);
    const severity = classifyMove(scoreToCp(before.score), scoreToCp(playedScore));
    if (!severity) continue;
    found.push({
      move,
      severity,
      bestMove: before.best,
      line: before.pv.length > 0 ? before.pv : [before.best],
      bestScore: before.score,
      playedScore,
      depth: before.depth,
    });
  }
  return found;
}
