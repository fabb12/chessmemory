import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '../../src/components/account/AccountCard';
import { DEFAULT_SETTINGS } from '../../src/db/schema';
import {
  downloadProgress,
  fetchPreferences,
  rowToSettings,
  sameSettings,
  savePreferences,
  settingsToRow,
  uploadProgress,
} from '../../src/features/account/cloud';
import { t } from '../../src/i18n';
import { fetchRecentGames, isValidUsername } from '../../src/services/gameImport';
import { isSupabaseConfigured } from '../../src/services/supabase';
import { fakeSupabase } from '../fakeSupabase';

describe('preferenze dell’account', () => {
  it('converte le preferenze nella riga della tabella e ritorno', () => {
    const settings = { theme: 'dark', boardOrientation: 'black', analysisDepth: 'deep', playerName: ' Marco ' } as const;
    const row = settingsToRow(settings, 'u1');
    expect(row).toEqual({ user_id: 'u1', theme: 'dark', board_orientation: 'black', analysis_depth: 'deep', player_name: 'Marco' });
    expect(rowToSettings(row)).toEqual({ ...settings, playerName: 'Marco' });
    expect(sameSettings(rowToSettings(row), settings)).toBe(true);
    expect(sameSettings(DEFAULT_SETTINGS, settings)).toBe(false);
  });

  it('tratta i dati remoti come non attendibili', () => {
    expect(rowToSettings({ theme: 'neon', board_orientation: 42, analysis_depth: null, player_name: 'x'.repeat(200) })).toEqual({
      ...DEFAULT_SETTINGS,
      playerName: 'x'.repeat(60),
    });
  });

  it('legge e salva le preferenze solo per l’utente indicato', async () => {
    const { client, tables } = fakeSupabase({
      user_preferences: [{ user_id: 'altro', theme: 'dark', board_orientation: 'white', analysis_depth: 'deep', player_name: 'X' }],
    });
    expect(await fetchPreferences(client, 'u1')).toBeNull();
    await savePreferences(client, 'u1', { ...DEFAULT_SETTINGS, theme: 'light' });
    expect(await fetchPreferences(client, 'u1')).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
    await savePreferences(client, 'u1', { ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(tables.user_preferences).toHaveLength(2);
    expect((await fetchPreferences(client, 'altro'))?.boardOrientation).toBe('white');
  });

  it('salva e scarica i progressi', async () => {
    const { client } = fakeSupabase();
    expect(await downloadProgress(client, 'u1')).toBeNull();
    const backup = { app: 'chessmemory-ai', version: 2, exportedAt: '2026-11-12T10:00:00.000Z', data: {} } as never;
    await uploadProgress(client, 'u1', backup);
    expect(await downloadProgress(client, 'u1')).toEqual(backup);
  });

  it('senza variabili di ambiente gli account sono disattivati', () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('traduce gli errori di autenticazione', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe(t.account.errors.invalid);
    expect(authErrorMessage({ message: 'Email not confirmed' })).toBe(t.account.errors.notConfirmed);
    expect(authErrorMessage({ message: 'User already registered' })).toBe(t.account.errors.exists);
    expect(authErrorMessage({ message: 'x', status: 429 })).toBe(t.account.errors.rate);
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe(t.account.errors.network);
    expect(authErrorMessage({ message: 'boh' })).toBe(t.account.errors.generic('boh'));
  });
});

describe('importazione delle partite', () => {
  const PGN = '[Event "Rated"]\n[White "mario"]\n[Black "luigi"]\n[UTCDate "2026.11.01"]\n\n1. e4 e5 2. Nf3 Nc6 1-0';

  function response(body: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 404,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as Response;
  }

  it('controlla il nome utente prima di contattare il sito', async () => {
    expect(isValidUsername('mario_88')).toBe(true);
    expect(isValidUsername('a b')).toBe(false);
    expect(isValidUsername('../x')).toBe(false);
    await expect(fetchRecentGames('lichess', '../x', async () => response('')))
      .rejects.toThrow(/nome utente/);
  });

  it('Lichess: legge il PGN con più partite', async () => {
    const urls: string[] = [];
    const games = await fetchRecentGames('lichess', 'mario', async (url) => {
      urls.push(String(url));
      return response(`${PGN}\n\n${PGN.replace('mario', 'anna')}\n\n[Event "x"]\n\n1. e4 e5 2. Ke3 Ke6 3. Qxh8`);
    });
    expect(urls[0]).toContain('https://lichess.org/api/games/user/mario?max=10');
    expect(games.map((g) => g.label)).toEqual(['mario – luigi, 2026-11-01', 'anna – luigi, 2026-11-01']);
  });

  it('Chess.com: parte dall’archivio più recente e salta le varianti', async () => {
    const urls: string[] = [];
    const games = await fetchRecentGames('chesscom', 'Mario', async (url) => {
      const u = String(url);
      urls.push(u);
      if (u.endsWith('/archives')) {
        return response({ archives: ['https://api.chess.com/pub/player/mario/games/2026/10', 'https://api.chess.com/pub/player/mario/games/2026/11'] });
      }
      if (u.endsWith('/2026/11')) {
        return response({ games: [{ pgn: PGN, rules: 'chess' }, { pgn: PGN, rules: 'chess960' }] });
      }
      return response({ games: [{ pgn: PGN.replace('luigi', 'paolo'), rules: 'chess' }] });
    });
    expect(urls[0]).toBe('https://api.chess.com/pub/player/mario/games/archives');
    expect(games.map((g) => g.label)).toEqual(['mario – luigi, 2026-11-01', 'mario – paolo, 2026-11-01']);
  });

  it('segnala gli errori HTTP', async () => {
    await expect(fetchRecentGames('lichess', 'mario', async () => response('', false))).rejects.toThrow(/HTTP 404/);
  });
});
