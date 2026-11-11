import { useEffect } from 'react';
import type { ThemePreference } from '../types';

const THEME_HINT_KEY = 'cm-theme';

/**
 * Applica il tema al documento. La preferenza è salvata nel profilo
 * (IndexedDB); in localStorage resta solo una copia usata da index.html
 * per evitare il lampo di tema sbagliato all'avvio.
 */
export function useTheme(preference: ThemePreference | undefined): void {
  useEffect(() => {
    if (!preference) return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && Boolean(media?.matches));
      document.documentElement.classList.toggle('dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0d1a2a' : '#1a73d9');
    };
    apply();
    try {
      localStorage.setItem(THEME_HINT_KEY, preference);
    } catch {
      /* solo un suggerimento per l'avvio: si può ignorare */
    }
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [preference]);
}
