import type { Uci } from '../../types';
import { allLegalUci } from '../../utils/chess';
import type { Analysis } from '../engine/engine';
import { scoreToCp } from '../engine/uci';

/**
 * Livelli dell'avversario artificiale. Stockfish calcola sempre le varianti
 * migliori; la forza si regola scegliendo quanto lontano dalla mossa migliore
 * può spingersi l'AI (e quanto spesso si «distrae» con una mossa a caso).
 */

export type PlayLevelId = 1 | 2 | 3 | 4 | 5;

export interface PlayLevel {
  id: PlayLevelId;
  /** Elo indicativo, solo per orientarsi. */
  elo: number;
  /** Profondità di calcolo di Stockfish. */
  depth: number;
  /** Varianti considerate. */
  multiPv: number;
  /** Perdita massima accettata rispetto alla mossa migliore, in centipedoni. */
  maxLossCp: number;
  /** Probabilità di giocare una mossa legale qualsiasi (errore «umano»). */
  randomChance: number;
}

export const PLAY_LEVELS: Record<PlayLevelId, PlayLevel> = {
  1: { id: 1, elo: 600, depth: 4, multiPv: 5, maxLossCp: 450, randomChance: 0.25 },
  2: { id: 2, elo: 1000, depth: 6, multiPv: 5, maxLossCp: 220, randomChance: 0.1 },
  3: { id: 3, elo: 1400, depth: 8, multiPv: 4, maxLossCp: 110, randomChance: 0.03 },
  4: { id: 4, elo: 1800, depth: 11, multiPv: 3, maxLossCp: 45, randomChance: 0 },
  5: { id: 5, elo: 2200, depth: 15, multiPv: 1, maxLossCp: 0, randomChance: 0 },
};

export const PLAY_LEVEL_IDS = [1, 2, 3, 4, 5] as const satisfies readonly PlayLevelId[];

export function isPlayLevel(value: unknown): value is PlayLevelId {
  return typeof value === 'number' && (PLAY_LEVEL_IDS as readonly number[]).includes(value);
}

/**
 * Sceglie la mossa dell'AI nella posizione analizzata.
 * `random` restituisce numeri in [0, 1): iniettabile nei test.
 */
export function pickAiMove(analysis: Analysis, level: PlayLevel, random: () => number = Math.random): Uci | null {
  const lines = analysis.lines.filter((l) => l.pv[0]);
  const best = lines[0];
  if (!best) return analysis.bestMove;
  // Dal livello 2 in su un matto in una mossa non sfugge mai.
  const mateInOne = best.score.kind === 'mate' && best.score.value === 1;
  if (level.randomChance > 0 && !(mateInOne && level.id >= 2) && random() < level.randomChance) {
    const legal = allLegalUci(analysis.fen);
    if (legal.length > 0) return legal[Math.floor(random() * legal.length)] ?? best.pv[0]!;
  }
  const bestCp = scoreToCp(best.score);
  const candidates = lines.filter((l) => bestCp - scoreToCp(l.score) <= level.maxLossCp);
  if (candidates.length <= 1) return best.pv[0]!;
  // Le mosse migliori restano le più probabili: peso decrescente con la perdita.
  const weights = candidates.map((l) => 1 / (1 + (bestCp - scoreToCp(l.score)) / 60));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r < 0) return candidates[i]!.pv[0]!;
  }
  return candidates[candidates.length - 1]!.pv[0]!;
}

/** Livello di partenza proposto dal profilo (livello didattico 1–5 e livello dichiarato). */
export function suggestedLevel(adaptiveLevel: number, declared: string | null): PlayLevelId {
  const base = Math.max(1, Math.min(5, Math.round(adaptiveLevel)));
  const fromDeclared = declared === 'intermediate' ? 3 : 1;
  return Math.max(base, fromDeclared) as PlayLevelId;
}
