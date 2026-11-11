import { EXERCISES } from '../../data/exercises';
import type { Difficulty, Exercise } from '../../types';

/**
 * Sceglie il prossimo esercizio della valutazione iniziale: difficoltà più
 * vicina al livello richiesto, concetto non ancora usato, categoria il più
 * possibile diversa da quelle già viste.
 */
export function pickPlacementExercise(
  level: Difficulty,
  used: readonly Exercise[],
  pool: readonly Exercise[] = EXERCISES,
): Exercise | null {
  const usedConcepts = new Set(used.map((e) => e.conceptId));
  const categoryCount = (category: string) => used.filter((e) => e.category === category).length;
  const candidates = pool.filter((e) => !usedConcepts.has(e.conceptId));
  if (candidates.length === 0) return null;
  return (
    [...candidates].sort(
      (a, b) =>
        Math.abs(a.difficulty - level) - Math.abs(b.difficulty - level) ||
        categoryCount(a.category) - categoryCount(b.category) ||
        pool.indexOf(a) - pool.indexOf(b),
    )[0] ?? null
  );
}
