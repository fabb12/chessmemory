import type { Difficulty } from '../../types';
import type { TaskQuality } from '../learning/moveTask';

/**
 * Difficoltà adattiva (modulo distinto da FSRS).
 *
 * Il livello 1–5 è un livello *didattico* e non corrisponde a un rating Elo.
 * Tutte le soglie sono qui, documentate e modificabili.
 */
export interface AdaptationConfig {
  /** Quanti risultati recenti vengono considerati. */
  windowSize: number;
  /** Risultati minimi dall'ultimo cambio di livello prima di cambiare ancora (anti-oscillazione). */
  minResultsBetweenChanges: number;
  /** Media minima della finestra per salire di livello. */
  promoteThreshold: number;
  /** Quanti risultati recenti si guardano per scendere. */
  demoteWindow: number;
  /** Media massima degli ultimi `demoteWindow` risultati per scendere. */
  demoteThreshold: number;
  minLevel: Difficulty;
  maxLevel: Difficulty;
}

export const DEFAULT_ADAPTATION_CONFIG: AdaptationConfig = {
  windowSize: 5,
  minResultsBetweenChanges: 4,
  promoteThreshold: 0.8,
  demoteWindow: 3,
  demoteThreshold: 0.3,
  minLevel: 1,
  maxLevel: 5,
};

export interface AdaptiveState {
  level: Difficulty;
  /** Punteggi 0–1 più recenti (il più nuovo in fondo). */
  recentScores: number[];
  resultsSinceChange: number;
  lastChange: 'up' | 'down' | null;
}

export function initialAdaptiveState(level: Difficulty): AdaptiveState {
  return { level, recentScores: [], resultsSinceChange: 0, lastChange: null };
}

function clampLevel(value: number, cfg: Pick<AdaptationConfig, 'minLevel' | 'maxLevel'>): Difficulty {
  return Math.min(cfg.maxLevel, Math.max(cfg.minLevel, Math.round(value))) as Difficulty;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Aggiorna il livello dopo un concetto completato.
 * - Sale dopo prestazioni ripetutamente buone (media alta su una finestra piena).
 * - Scende dopo errori ripetuti (media molto bassa sugli ultimi risultati).
 * - Dopo ogni cambio serve un numero minimo di nuovi risultati: niente salti continui.
 * Il tempo di risposta non viene considerato.
 */
export function updateDifficulty(
  state: AdaptiveState,
  score: number,
  cfg: AdaptationConfig = DEFAULT_ADAPTATION_CONFIG,
): AdaptiveState {
  const recentScores = [...state.recentScores, Math.min(1, Math.max(0, score))].slice(-cfg.windowSize);
  const resultsSinceChange = state.resultsSinceChange + 1;
  const base: AdaptiveState = { ...state, recentScores, resultsSinceChange, lastChange: state.lastChange };

  if (resultsSinceChange < cfg.minResultsBetweenChanges) return base;

  const canPromote =
    state.level < cfg.maxLevel &&
    recentScores.length >= cfg.windowSize &&
    mean(recentScores) >= cfg.promoteThreshold;
  if (canPromote) {
    return { level: clampLevel(state.level + 1, cfg), recentScores: [], resultsSinceChange: 0, lastChange: 'up' };
  }

  const lastFew = recentScores.slice(-cfg.demoteWindow);
  const canDemote =
    state.level > cfg.minLevel &&
    lastFew.length >= cfg.demoteWindow &&
    mean(lastFew) <= cfg.demoteThreshold;
  if (canDemote) {
    return { level: clampLevel(state.level - 1, cfg), recentScores: [], resultsSinceChange: 0, lastChange: 'down' };
  }

  return base;
}

/** Risposta della valutazione iniziale (oggi non più proposta: i profili partono dal livello 1). */
export interface PlacementAnswer {
  level: Difficulty;
  quality: TaskQuality;
}
