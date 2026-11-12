import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase, facoltativo. Se le variabili VITE_SUPABASE_URL e
 * VITE_SUPABASE_ANON_KEY non sono impostate in fase di build, l'app funziona
 * come prima, solo in locale, e la sezione Account lo spiega.
 *
 * La libreria è caricata solo quando serve (import dinamico), così non pesa
 * sull'avvio dell'app.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

/**
 * Interruttore generale degli account. Per ora l'accesso con Supabase è
 * disattivato: l'app funziona solo in locale, senza login, anche se le
 * variabili di ambiente sono impostate. Rimettere a `true` per riattivarlo.
 */
export const ACCOUNTS_ENABLED = false;

export function isSupabaseConfigured(): boolean {
  if (!ACCOUNTS_ENABLED) return false;
  return /^https:\/\/\S+$/.test(url) && anonKey.length > 20;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: {
          // PKCE: i link delle email tornano con «?code=…», che non interferisce
          // con le rotte nel frammento (#/profilo) usate dall'app.
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'cm-auth',
        },
      }),
    )
    .catch(() => {
      clientPromise = null;
      return null;
    });
  return clientPromise;
}

/** Indirizzo a cui Supabase rimanda dopo i link delle email (radice dell'app, senza frammento). */
export function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
