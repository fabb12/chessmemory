import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Settings } from '../../db/schema';
import { updateSettings } from '../../services/progress';
import { authRedirectUrl, getSupabase, isSupabaseConfigured } from '../../services/supabase';
import { fetchPreferences, sameSettings, savePreferences } from './cloud';

export type AccountStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface AccountContextValue {
  status: AccountStatus;
  email: string | null;
  userId: string | null;
  /** L'utente ha aperto il link per reimpostare la password. */
  recovery: boolean;
  sync: SyncStatus;
  client: SupabaseClient | null;
  signIn(email: string, password: string): Promise<void>;
  /** 'confirm' se Supabase richiede la conferma dell'indirizzo email. */
  signUp(email: string, password: string): Promise<'confirm' | 'signedIn'>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}

const disabledValue: AccountContextValue = {
  status: 'disabled',
  email: null,
  userId: null,
  recovery: false,
  sync: 'idle',
  client: null,
  signIn: () => Promise.reject(new Error('Account non configurati')),
  signUp: () => Promise.reject(new Error('Account non configurati')),
  sendPasswordReset: () => Promise.reject(new Error('Account non configurati')),
  updatePassword: () => Promise.reject(new Error('Account non configurati')),
  signOut: () => Promise.resolve(),
};

const AccountContext = createContext<AccountContextValue>(disabledValue);

export function useAccount(): AccountContextValue {
  return useContext(AccountContext);
}

const PUSH_DELAY_MS = 600;

/**
 * Gestisce la sessione Supabase e sincronizza le preferenze dell'account:
 * - all'accesso, se il cloud ha già delle preferenze vengono applicate su
 *   questo dispositivo; altrimenti si caricano quelle locali;
 * - ogni modifica successiva delle preferenze viene salvata nel cloud.
 * Senza configurazione Supabase il contesto resta «disabled» e non fa nulla.
 */
export function AccountProvider({ settings, children }: { settings: Settings; children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [status, setStatus] = useState<AccountStatus>(configured ? 'loading' : 'disabled');
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [sync, setSync] = useState<SyncStatus>('idle');
  const lastSynced = useRef<Settings | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Avvio del client e ascolto dei cambi di sessione.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void getSupabase().then((supabase) => {
      if (cancelled) return;
      if (!supabase) {
        setStatus('disabled');
        return;
      }
      setClient(supabase);
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecovery(true);
          window.location.hash = '#/profilo';
        }
        const next = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
        setUser((prev) => (prev?.id === next?.id && prev?.email === next?.email ? prev : next));
        setStatus(next ? 'signedIn' : 'signedOut');
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [configured]);

  // Prima sincronizzazione dopo l'accesso.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!client || !userId) {
      lastSynced.current = null;
      setSync('idle');
      return;
    }
    let cancelled = false;
    setSync('syncing');
    (async () => {
      try {
        const remote = await fetchPreferences(client, userId);
        if (cancelled) return;
        if (remote) {
          lastSynced.current = remote;
          if (!sameSettings(remote, settingsRef.current)) await updateSettings(remote);
        } else {
          const local = settingsRef.current;
          await savePreferences(client, userId, local);
          lastSynced.current = local;
        }
        if (!cancelled) setSync('synced');
      } catch {
        if (!cancelled) setSync('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  // Salvataggio delle modifiche successive.
  useEffect(() => {
    if (!client || !userId || !lastSynced.current) return;
    if (sameSettings(settings, lastSynced.current)) return;
    setSync('syncing');
    const timer = window.setTimeout(() => {
      savePreferences(client, userId, settings)
        .then(() => {
          lastSynced.current = settings;
          setSync('synced');
        })
        .catch(() => setSync('error'));
    }, PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [client, userId, settings]);

  const requireClient = useCallback(() => {
    if (!client) throw new Error('Account non disponibili');
    return client;
  }, [client]);

  const value = useMemo<AccountContextValue>(() => {
    if (!configured) return disabledValue;
    return {
      status,
      email: user?.email ?? null,
      userId,
      recovery,
      sync,
      client,
      async signIn(email, password) {
        const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUp(email, password) {
        const { data, error } = await requireClient().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        return data.session ? 'signedIn' : 'confirm';
      },
      async sendPasswordReset(email) {
        const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirectUrl(),
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await requireClient().auth.updateUser({ password });
        if (error) throw error;
        setRecovery(false);
      },
      async signOut() {
        await requireClient().auth.signOut();
        setRecovery(false);
      },
    };
  }, [client, configured, recovery, requireClient, status, sync, user?.email, userId]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
