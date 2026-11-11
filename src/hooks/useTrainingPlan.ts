import { useMemo } from 'react';
import { buildSessionPlan, type SessionPlan } from '../features/learning/sessionBuilder';
import { computeConceptAccuracy } from '../features/progress/stats';
import { useAttempts, useCards, useProfile } from './useData';

/** Piano dell'allenamento di oggi, calcolato dai dati reali dell'utente. */
export function useTrainingPlan(now: number): SessionPlan | undefined {
  const profile = useProfile();
  const cards = useCards();
  const attempts = useAttempts();
  return useMemo(() => {
    if (!profile || !cards || !attempts) return undefined;
    return buildSessionPlan({
      cards,
      level: profile.adaptive.level,
      now,
      accuracy: computeConceptAccuracy(attempts),
    });
  }, [profile, cards, attempts, now]);
}
