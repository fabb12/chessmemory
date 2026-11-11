import { CONCEPTS } from '../../data/exercises';
import type { AttemptRecord } from '../../db/schema';
import { CATEGORIES, type Category, type Concept } from '../../types';
import { isConsolidated, isDue, type StoredCard } from '../memory/scheduler';
import type { ConceptAccuracy } from '../learning/sessionBuilder';
import { dayKey } from './streak';

/**
 * Statistiche del Memory DNA. Sono conteggi sui risultati reali degli
 * esercizi: non misurano la memoria in senso scientifico.
 */
export interface TrendPoint {
  day: string;
  answers: number;
  /** Percentuale di successo 0–1 del giorno. */
  rate: number;
}

export interface CategoryStats {
  category: Category;
  answers: number;
  correct: number;
  /** null finché non ci sono risposte. */
  successRate: number | null;
  /** Compiti di mossa completati (RICORDA e RICONOSCI). */
  exercisesCompleted: number;
  dueReviews: number;
  studiedConcepts: number;
  totalConcepts: number;
  consolidated: number;
  /** Concetti studiati ma non ancora consolidati. */
  toReview: number;
  trend: TrendPoint[];
}

export const STATS_CONFIG = {
  trendDays: 10,
  strongRate: 0.75,
  weakRate: 0.7,
  minAnswersForJudgement: 3,
} as const;

/** Le risposte della valutazione iniziale non entrano nel profilo. */
function counted(attempts: readonly AttemptRecord[]): AttemptRecord[] {
  return attempts.filter((a) => a.activity !== 'placement');
}

export function buildTrend(attempts: readonly AttemptRecord[], maxDays: number = STATS_CONFIG.trendDays): TrendPoint[] {
  const byDay = new Map<string, { answers: number; correct: number }>();
  for (const a of attempts) {
    const key = dayKey(a.answeredAt);
    const entry = byDay.get(key) ?? { answers: 0, correct: 0 };
    entry.answers += 1;
    if (a.correct) entry.correct += 1;
    byDay.set(key, entry);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxDays)
    .map(([day, v]) => ({ day, answers: v.answers, rate: v.correct / v.answers }));
}

export function computeCategoryStats(
  attempts: readonly AttemptRecord[],
  cards: readonly StoredCard[],
  now: number,
  concepts: readonly Concept[] = CONCEPTS,
): CategoryStats[] {
  const valid = counted(attempts);
  const categoryOf = new Map(concepts.map((c) => [c.id, c.category]));
  return CATEGORIES.map((category) => {
    const own = valid.filter((a) => a.category === category);
    const ownCards = cards.filter((c) => categoryOf.get(c.conceptId) === category);
    const correct = own.filter((a) => a.correct).length;
    const consolidated = ownCards.filter(isConsolidated).length;
    return {
      category,
      answers: own.length,
      correct,
      successRate: own.length > 0 ? correct / own.length : null,
      exercisesCompleted: own.filter((a) => a.activity === 'recall' || a.activity === 'transfer').length,
      dueReviews: ownCards.filter((c) => isDue(c, now)).length,
      studiedConcepts: ownCards.length,
      totalConcepts: concepts.filter((c) => c.category === category).length,
      consolidated,
      toReview: ownCards.length - consolidated,
      trend: buildTrend(own),
    };
  });
}

export function computeConceptAccuracy(attempts: readonly AttemptRecord[]): Map<string, ConceptAccuracy> {
  const map = new Map<string, ConceptAccuracy>();
  for (const a of counted(attempts)) {
    const entry = map.get(a.conceptId) ?? { answers: 0, correct: 0 };
    entry.answers += 1;
    if (a.correct) entry.correct += 1;
    map.set(a.conceptId, entry);
  }
  return map;
}

export type Insight =
  | { kind: 'empty' }
  | { kind: 'strong-weak'; strong: Category; weakConceptId: string }
  | { kind: 'weak'; weakConceptId: string }
  | { kind: 'strong'; strong: Category }
  | { kind: 'steady' };

/** Messaggio personalizzato: regole locali sui risultati, nessun servizio esterno. */
export function computeInsight(
  stats: readonly CategoryStats[],
  accuracy: ReadonlyMap<string, ConceptAccuracy>,
): Insight {
  if (stats.every((s) => s.answers === 0)) return { kind: 'empty' };
  const min = STATS_CONFIG.minAnswersForJudgement;

  const strong = stats
    .filter((s) => s.answers >= min && (s.successRate ?? 0) >= STATS_CONFIG.strongRate)
    .sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0))[0];

  const weak = [...accuracy.entries()]
    .filter(([, v]) => v.answers >= min && v.correct / v.answers < STATS_CONFIG.weakRate)
    .sort(([, a], [, b]) => a.correct / a.answers - b.correct / b.answers)[0];

  if (strong && weak) return { kind: 'strong-weak', strong: strong.category, weakConceptId: weak[0] };
  if (weak) return { kind: 'weak', weakConceptId: weak[0] };
  if (strong) return { kind: 'strong', strong: strong.category };
  return { kind: 'steady' };
}
