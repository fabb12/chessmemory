import { it, type Dictionary } from './it';

/** Lingue disponibili. Per ora solo l'italiano. */
const dictionaries: Record<string, Dictionary> = { it };

export const DEFAULT_LOCALE = 'it';

/** Dizionario attivo. Sostituire qui la selezione quando verranno aggiunte altre lingue. */
export const t: Dictionary = dictionaries[DEFAULT_LOCALE] ?? it;

export const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, { day: 'numeric', month: 'short' });
export const dateTimeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatRelativeDay(target: number, now: number): string {
  const start = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((start(target) - start(now)) / 86_400_000);
  if (days <= 0) return t.dates.today;
  if (days === 1) return t.dates.tomorrow;
  return t.dates.inDays(days);
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
