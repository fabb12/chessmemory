import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/database';
import { ACTIVE_SESSION_ID, PROFILE_ID } from '../db/schema';

/** Letture reattive dal database locale: `undefined` finché il dato non è caricato. */

export function useProfile() {
  return useLiveQuery(async () => (await db.profile.get(PROFILE_ID)) ?? null, []);
}

export function useCards() {
  return useLiveQuery(() => db.cards.toArray(), []);
}

export function useAttempts() {
  return useLiveQuery(() => db.attempts.toArray(), []);
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.orderBy('finishedAt').reverse().toArray(), []);
}

export function useActiveSession() {
  return useLiveQuery(async () => (await db.activeSession.get(ACTIVE_SESSION_ID)) ?? null, []);
}

/** Orario corrente, aggiornato ogni minuto (per scadenze e saluti). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMistakes() {
  return useLiveQuery(() => db.mistakes.orderBy('createdAt').reverse().toArray(), []);
}

/** `null` se l'errore non esiste. */
export function useMistake(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await db.mistakes.get(id)) ?? null) : null), [id]);
}

export function usePhoto(id: string | null | undefined) {
  return useLiveQuery(async () => (id ? ((await db.photos.get(id)) ?? null) : null), [id]);
}
