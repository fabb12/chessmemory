import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountCard } from '../../src/components/account/AccountCard';
import { db } from '../../src/db/database';
import { DEFAULT_SETTINGS, PROFILE_ID } from '../../src/db/schema';
import { AccountProvider } from '../../src/features/account/AccountProvider';
import { useProfile } from '../../src/hooks/useData';
import { ensureProfile, updateSettings } from '../../src/services/progress';
import { fakeSupabase } from '../fakeSupabase';

const state = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../../src/services/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => Promise.resolve(state.client),
  authRedirectUrl: () => 'http://localhost/',
}));

function withAuth(tables: Parameters<typeof fakeSupabase>[0]) {
  const fake = fakeSupabase(tables);
  const auth = {
    onAuthStateChange(cb: (event: string, session: unknown) => void) {
      setTimeout(() => cb('INITIAL_SESSION', { user: { id: 'u1', email: 'anna@example.com' } }), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signOut: vi.fn(async () => ({ error: null })),
  };
  state.client = Object.assign(fake.client, { auth });
  return fake;
}

function Harness() {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <AccountProvider settings={profile.settings}>
      <AccountCard />
    </AccountProvider>
  );
}

beforeEach(async () => {
  await db.profile.clear();
  await ensureProfile();
});

describe('account e preferenze', () => {
  it('all’accesso applica le preferenze salvate nell’account e poi salva le modifiche', async () => {
    const fake = withAuth({
      user_preferences: [{ user_id: 'u1', theme: 'dark', board_orientation: 'black', analysis_depth: 'deep', player_name: 'anna' }],
    });
    render(<Harness />);

    expect(await screen.findByTestId('account-email')).toHaveTextContent('anna@example.com');
    await waitFor(async () =>
      expect((await db.profile.get(PROFILE_ID))!.settings).toEqual({
        theme: 'dark',
        boardOrientation: 'black',
        analysisDepth: 'deep',
        playerName: 'anna',
      }),
    );
    await waitFor(() => expect(screen.getByTestId('account-sync')).toHaveTextContent('Preferenze salvate'));
    expect(fake.calls.filter((c) => c.op === 'upsert')).toHaveLength(0);

    await updateSettings({ theme: 'light' });
    await waitFor(() => expect(fake.tables.user_preferences![0]).toMatchObject({ theme: 'light', board_orientation: 'black' }), {
      timeout: 3000,
    });
  });

  it('se l’account non ha preferenze carica quelle del dispositivo', async () => {
    await updateSettings({ boardOrientation: 'white', playerName: 'marco' });
    const fake = withAuth({});
    render(<Harness />);
    await waitFor(() =>
      expect(fake.tables.user_preferences?.[0]).toMatchObject({
        user_id: 'u1',
        theme: DEFAULT_SETTINGS.theme,
        board_orientation: 'white',
        player_name: 'marco',
      }),
    );
  });
});
