import { useSyncExternalStore } from 'react';

/**
 * Nome dell'allievo: si imposta nel Profilo (o lo chiede il tutor all'inizio)
 * e il tutor lo usa quando parla. Resta solo su questo dispositivo.
 */

const NAME_KEY = 'cm.user.name';
const listeners = new Set<() => void>();

export function getUserName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setUserName(value: string): void {
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, 40);
  try {
    if (clean) localStorage.setItem(NAME_KEY, clean);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // archivio non disponibile: vale solo per questa visita
  }
  listeners.forEach((l) => l());
}

export function useUserName(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getUserName,
    () => '',
  );
}
