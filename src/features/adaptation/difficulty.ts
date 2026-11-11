import type { DeclaredLevel, Difficulty } from '../../types';
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

// ───────────── Valutazione iniziale ─────────────

export interface PlacementConfig {
  exerciseCount: number;
  startLevel: Record<DeclaredLevel, Difficulty>;
  /** Livello massimo assegnabile dalla valutazione iniziale. */
  maxResultLevel: Record<DeclaredLevel, Difficulty>;
}

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  exerciseCount: 5,
  startLevel: { beginner: 1, unsure: 2, intermediate: 3 },
  maxResultLevel: { beginner: 3, unsure: 4, intermediate: 4 },
};

/** Livello del prossimo esercizio di valutazione («scala»: su se bene, giù se male). */
export function nextPlacementLevel(current: Difficulty, quality: TaskQuality): Difficulty {
  const delta = quality === 'clean' ? 1 : quality === 'failed' ? -1 : 0;
  return clampLevel(current + delta, { minLevel: 1, maxLevel: 5 });
}

export interface PlacementAnswer {
  level: Difficulty;
  quality: TaskQuality;
}

/**
 * Livello iniziale: il livello più alto risolto senza aiuti almeno una volta,
 * ridotto di uno se a quel livello ci sono stati anche fallimenti; se nulla è
 * stato risolto senza aiuti si parte dal livello 1.
 */
export function placementResult(
  declared: DeclaredLevel,
  answers: PlacementAnswer[],
  cfg: PlacementConfig = DEFAULT_PLACEMENT_CONFIG,
): Difficulty {
  const clean = answers.filter((a) => a.quality === 'clean').map((a) => a.level);
  if (clean.length === 0) return 1;
  const top = Math.max(...clean);
  const failedAtTop = answers.some((a) => a.level === top && a.quality === 'failed');
  const level = failedAtTop ? top - 1 : top;
  return clampLevel(Math.min(level, cfg.maxResultLevel[declared]), { minLevel: 1, maxLevel: 5 });
}
