import { useMemo } from 'react';
import type { Difficulty } from '../types';
import { buildSessionPlan, type SessionPlan } from '../features/learning/sessionBuilder';
import { computeConceptAccuracy } from '../features/progress/stats';
import { useAttempts, useCards, useProfile } from './useData';

/** Piano dell'allenamento di oggi, calcolato dai dati reali dell'utente. */
export function useTrainingPlan(now: number, levelOverride?: Difficulty | null): SessionPlan | undefined {
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
    });
  }, [profile, cards, attempts, now, levelOverride]);
}
