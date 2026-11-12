import { useMemo } from 'react';
import type { Difficulty, SessionItem } from '../types';
import {
  buildProposals,
  buildSessionPlan,
  PROPOSAL_COUNT,
  seededRng,
  type SessionPlan,
} from '../features/learning/sessionBuilder';
import { computeConceptAccuracy } from '../features/progress/stats';
import { useAttempts, useCards, useProfile } from './useData';

/**
 * Piano dell'allenamento di oggi, calcolato dai dati reali dell'utente.
 * Con `seed` concetti ed esercizi cambiano a ogni nuovo seme; senza, il piano è sempre lo stesso.
 */
export function useTrainingPlan(
  now: number,
  levelOverride?: Difficulty | null,
  seed?: number,
): SessionPlan | undefined {
  const profile = useProfile();
  const cards = useCards();
  const attempts = useAttempts();
  return useMemo(() => {
    if (!profile || !cards || !attempts) return undefined;
    return buildSessionPlan({
      cards,
      level: levelOverride ?? profile.adaptive.level,
      now,
      accuracy: computeConceptAccuracy(attempts),
      ...(seed !== undefined ? { rng: seededRng(seed) } : {}),
    });
  }, [profile, cards, attempts, now, levelOverride, seed]);
}

/** Altri concetti del livello scelto, tra cui l'utente può scegliere (diversi a ogni seme). */
export function useTrainingProposals(
  plan: SessionPlan | undefined,
  levelOverride: Difficulty | null | undefined,
  seed: number,
): SessionItem[] {
  const profile = useProfile();
  const cards = useCards();
  return useMemo(() => {
    if (!profile || !cards || !plan) return [];
    return buildProposals({
      cards,
      level: levelOverride ?? profile.adaptive.level,
      rng: seededRng(seed + 1),
      exclude: new Set(plan.items.map((i) => i.conceptId)),
      count: Math.max(0, PROPOSAL_COUNT - plan.items.length),
    });
  }, [profile, cards, plan, levelOverride, seed]);
}
