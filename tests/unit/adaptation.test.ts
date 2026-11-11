import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADAPTATION_CONFIG,
  initialAdaptiveState,
  nextPlacementLevel,
  placementResult,
  updateDifficulty,
  type AdaptiveState,
} from '../../src/features/adaptation/difficulty';
import { pickPlacementExercise } from '../../src/features/onboarding/placement';
import { performanceScore } from '../../src/features/memory/rating';
import type { Exercise } from '../../src/types';
import { conceptResult } from './helpers';

function feed(state: AdaptiveState, scores: number[]): AdaptiveState {
  return scores.reduce((s, score) => updateDifficulty(s, score), state);
}

describe('difficoltà adattiva', () => {
  it('sale di livello solo dopo prestazioni ripetutamente buone', () => {
    let s = feed(initialAdaptiveState(2), [1, 1, 1, 1]);
    expect(s.level).toBe(2); // finestra non ancora piena
    s = updateDifficulty(s, 1);
    expect(s.level).toBe(3);
    expect(s.lastChange).toBe('up');
    expect(s.recentScores).toEqual([]);
  });

  it('un singolo successo o un singolo errore non cambiano il livello', () => {
    expect(feed(initialAdaptiveState(3), [1]).level).toBe(3);
    expect(feed(initialAdaptiveState(3), [0]).level).toBe(3);
    expect(feed(initialAdaptiveState(3), [1, 0, 1, 0, 1, 0, 1, 0]).level).toBe(3);
  });

  it('scende dopo errori ripetuti', () => {
    const s = feed(initialAdaptiveState(3), [0.9, 0, 0.2, 0]);
    expect(s.level).toBe(2);
    expect(s.lastChange).toBe('down');
  });

  it('evita salti continui: dopo un cambio servono nuovi risultati', () => {
    let s = feed(initialAdaptiveState(1), [1, 1, 1, 1, 1]);
    expect(s.level).toBe(2);
    s = feed(s, [1, 1, 1]);
    expect(s.level).toBe(2);
    s = feed(s, [0, 0, 0]);
    // tre errori dopo il cambio, ma con sei risultati dal cambio: può scendere
    expect(s.level).toBe(1);
    expect(feed(s, [0, 0, 0]).level).toBe(1); // mai sotto il minimo
  });

  it('rispetta i limiti 1–5', () => {
    expect(feed(initialAdaptiveState(5), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).level).toBe(5);
    expect(feed(initialAdaptiveState(1), [0, 0, 0, 0, 0, 0]).level).toBe(1);
  });

  it('usa soglie configurabili', () => {
    const strict = { ...DEFAULT_ADAPTATION_CONFIG, promoteThreshold: 0.95 };
    const scores = [0.9, 0.9, 0.9, 0.9, 0.9];
    expect(scores.reduce((s, x) => updateDifficulty(s, x, strict), initialAdaptiveState(2)).level).toBe(2);
    expect(feed(initialAdaptiveState(2), scores).level).toBe(3);
  });

  it('il punteggio considera correttezza e indizi, non il tempo', () => {
    const fast = conceptResult('pin', 'review', 'clean');
    const slow = { ...fast, recall: { ...fast.recall, responseMs: 600_000 } };
    expect(performanceScore(slow)).toBe(performanceScore(fast));
    expect(performanceScore(fast)).toBe(1);
    expect(performanceScore(conceptResult('pin', 'review', 'assisted'))).toBeLessThan(1);
    expect(performanceScore(conceptResult('pin', 'review', 'failed'))).toBe(0);
    expect(performanceScore(conceptResult('pin', 'review', 'clean', false, 'failed'))).toBeCloseTo(0.6);
    expect(performanceScore(conceptResult('pin', 'review', 'clean', true, null))).toBe(1);
  });
});

describe('valutazione iniziale', () => {
  it('la scala sale con risposte pulite e scende con i fallimenti', () => {
    expect(nextPlacementLevel(2, 'clean')).toBe(3);
    expect(nextPlacementLevel(2, 'assisted')).toBe(2);
    expect(nextPlacementLevel(2, 'failed')).toBe(1);
    expect(nextPlacementLevel(1, 'failed')).toBe(1);
    expect(nextPlacementLevel(5, 'clean')).toBe(5);
  });

  it('assegna il livello dal più alto risolto senza aiuti, entro il tetto del livello dichiarato', () => {
    expect(placementResult('beginner', [])).toBe(1);
    expect(placementResult('beginner', [{ level: 1, quality: 'failed' }, { level: 1, quality: 'assisted' }])).toBe(1);
    expect(
      placementResult('beginner', [
        { level: 1, quality: 'clean' },
        { level: 2, quality: 'clean' },
        { level: 3, quality: 'failed' },
        { level: 2, quality: 'clean' },
        { level: 3, quality: 'assisted' },
      ]),
    ).toBe(2);
    const allClean = [1, 2, 3, 4, 5].map((level) => ({ level: level as 1, quality: 'clean' as const }));
    expect(placementResult('beginner', allClean)).toBe(3);
    expect(placementResult('intermediate', allClean)).toBe(4);
    expect(
      placementResult('intermediate', [
        { level: 3, quality: 'clean' },
        { level: 4, quality: 'failed' },
        { level: 3, quality: 'failed' },
      ]),
    ).toBe(2);
  });

  it('sceglie esercizi di concetti diversi vicini al livello richiesto', () => {
    const used: Exercise[] = [];
    for (const level of [1, 2, 3, 2, 3] as const) {
      const next = pickPlacementExercise(level, used);
      expect(next).not.toBeNull();
      expect(next!.difficulty).toBe(level);
      expect(used.some((e) => e.conceptId === next!.conceptId)).toBe(false);
      used.push(next!);
    }
    expect(new Set(used.map((e) => e.category)).size).toBeGreaterThan(1);
  });
});
