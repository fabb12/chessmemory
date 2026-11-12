import type { Uci } from '../../types';

/**
 * Lettura dell'output UCI di Stockfish. Funzioni pure, senza dipendenze dal
 * browser, così da poter essere verificate nei test.
 *
 * I punteggi UCI sono sempre dal punto di vista del giocatore al tratto.
 */

export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number };

export interface EngineLine {
  /** Indice della variante (1 = migliore). */
  multipv: number;
  depth: number;
  score: Score;
  /** Variante principale in notazione UCI. */
  pv: Uci[];
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Interpreta una riga «info … score … pv …». Restituisce null per le altre righe. */
export function parseInfoLine(line: string): EngineLine | null {
  if (!line.startsWith('info ')) return null;
  const tokens = line.trim().split(/\s+/);
  let depth: number | null = null;
  let multipv = 1;
  let score: Score | null = null;
  let pv: Uci[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'depth') depth = Number(tokens[++i]);
    else if (token === 'multipv') multipv = Number(tokens[++i]);
    else if (token === 'score') {
      const kind = tokens[++i];
      const value = Number(tokens[++i]);
      if ((kind === 'cp' || kind === 'mate') && Number.isFinite(value)) score = { kind, value };
      // «lowerbound» / «upperbound»: punteggi provvisori, da scartare.
      if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') return null;
    } else if (token === 'pv') {
      pv = tokens.slice(i + 1).filter((m) => UCI_MOVE.test(m));
      break;
    }
  }
  if (depth === null || !Number.isFinite(depth) || !score || pv.length === 0) return null;
  return { multipv, depth, score, pv };
}

/** «bestmove e2e4 ponder e7e5» → "e2e4"; «bestmove (none)» → null. */
export function parseBestMove(line: string): Uci | null | undefined {
  if (!line.startsWith('bestmove')) return undefined;
  const move = line.split(/\s+/)[1];
  return move && UCI_MOVE.test(move) ? move : null;
}

/** Valore convenzionale di un matto, in centipedoni. */
export const MATE_CP = 100_000;

/**
 * Converte un punteggio in centipedoni confrontabili: un matto vale sempre più
 * di qualunque vantaggio materiale, e un matto più vicino vale di più.
 */
export function scoreToCp(score: Score): number {
  if (score.kind === 'cp') return score.value;
  if (score.value > 0) return MATE_CP - score.value * 100;
  // «mate 0» (già matto) o «mate -n» (si subisce matto).
  return -MATE_CP - score.value * 100;
}

export function negateScore(score: Score): Score {
  return { kind: score.kind, value: -score.value };
}

/**
 * Probabilità di vittoria (tra -1 e 1) a partire dal punteggio, con la stessa
 * curva usata dall'analisi di Lichess. Serve a confrontare gli errori in modo
 * equo: perdere 200 centipedoni in una posizione pari è grave, in una posizione
 * già vinta di 15 pedoni molto meno.
 */
export function winningChances(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 2 / (1 + Math.exp(-0.00368208 * clamped)) - 1;
}

export type Severity = 'inaccuracy' | 'mistake' | 'blunder';

/** Soglie sul calo delle probabilità di vittoria (scala da -1 a 1). */
export const SEVERITY_THRESHOLDS: Record<Severity, number> = {
  inaccuracy: 0.1,
  mistake: 0.2,
  blunder: 0.3,
};

/**
 * Classifica una mossa dal calo delle probabilità di vittoria del giocatore
 * che l'ha giocata. `bestCp` e `playedCp` sono dal suo punto di vista.
 */
export function classifyMove(bestCp: number, playedCp: number): Severity | null {
  const drop = winningChances(bestCp) - winningChances(playedCp);
  if (drop >= SEVERITY_THRESHOLDS.blunder) return 'blunder';
  if (drop >= SEVERITY_THRESHOLDS.mistake) return 'mistake';
  if (drop >= SEVERITY_THRESHOLDS.inaccuracy) return 'inaccuracy';
  return null;
}

/** Valutazione leggibile, dal punto di vista del Bianco: «+1,25», «−0,40», «M3», «−M2». */
export function formatScore(score: Score, whiteToMove: boolean): string {
  const sign = whiteToMove ? 1 : -1;
  if (score.kind === 'mate') {
    const v = score.value * sign;
    if (score.value === 0) return whiteToMove ? '−M0' : 'M0';
    return v > 0 ? `M${v}` : `−M${-v}`;
  }
  const pawns = (score.value * sign) / 100;
  const text = Math.abs(pawns).toFixed(2).replace('.', ',');
  return pawns > 0 ? `+${text}` : pawns < 0 ? `−${text}` : '0,00';
}
