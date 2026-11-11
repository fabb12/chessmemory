import type { Streak } from '../../db/schema';

/**
 * Sequenza giornaliera «gentile»: saltare un solo giorno non azzera la
 * sequenza. Si riparte da 1 soltanto dopo due o più giorni saltati.
 */
export const STREAK_CONFIG = {
  /** Giorni di pausa tollerati senza perdere la sequenza. */
  graceDays: 1,
} as const;

export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Differenza in giorni di calendario tra due chiavi YYYY-MM-DD. */
export function daysBetween(fromKey: string, toKey: string): number {
  const parse = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000);
}

export function initialStreak(): Streak {
  return { current: 0, best: 0, lastActiveDay: null };
}

/** Aggiorna la sequenza dopo un allenamento completato. */
export function registerTrainingDay(streak: Streak, now: number): Streak {
  const today = dayKey(now);
  if (streak.lastActiveDay === today) return streak;
  const gap = streak.lastActiveDay ? daysBetween(streak.lastActiveDay, today) : null;
  const continues = gap !== null && gap >= 1 && gap <= 1 + STREAK_CONFIG.graceDays;
  const current = continues ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastActiveDay: today };
}

/** Sequenza da mostrare oggi (0 se è ormai interrotta). */
export function currentStreak(streak: Streak, now: number): number {
  if (!streak.lastActiveDay) return 0;
  const gap = daysBetween(streak.lastActiveDay, dayKey(now));
  return gap <= 1 + STREAK_CONFIG.graceDays ? streak.current : 0;
}

export function trainedToday(streak: Streak, now: number): boolean {
  return streak.lastActiveDay === dayKey(now);
}
