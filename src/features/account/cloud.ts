import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, type Settings } from '../../db/schema';
import type { BackupFile } from '../../services/backup';

/**
 * Scambio dati con Supabase. Tabelle (vedi supabase/migrations):
 * - user_preferences: una riga per utente con le preferenze;
 * - user_progress: una riga per utente con il backup dei progressi (JSON).
 * Le regole RLS consentono a ciascun utente di leggere e scrivere solo le proprie righe.
 */

export interface PreferencesRow {
  user_id: string;
  theme: string;
  board_orientation: string;
  analysis_depth: string;
  player_name: string;
  updated_at?: string;
}

const THEMES = ['system', 'light', 'dark'] as const;
const ORIENTATIONS = ['auto', 'white', 'black'] as const;
const DEPTHS = ['quick', 'deep'] as const;
export const MAX_PLAYER_NAME = 60;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function settingsToRow(settings: Settings, userId: string): PreferencesRow {
  return {
    user_id: userId,
    theme: settings.theme,
    board_orientation: settings.boardOrientation,
    analysis_depth: settings.analysisDepth,
    player_name: settings.playerName.trim().slice(0, MAX_PLAYER_NAME),
  };
}

/** I dati remoti sono controllati come qualunque dato esterno: i valori sconosciuti tornano al predefinito. */
export function rowToSettings(row: Partial<Record<keyof PreferencesRow, unknown>>): Settings {
  return {
    theme: pick(row.theme, THEMES, DEFAULT_SETTINGS.theme),
    boardOrientation: pick(row.board_orientation, ORIENTATIONS, DEFAULT_SETTINGS.boardOrientation),
    analysisDepth: pick(row.analysis_depth, DEPTHS, DEFAULT_SETTINGS.analysisDepth),
    playerName: typeof row.player_name === 'string' ? row.player_name.trim().slice(0, MAX_PLAYER_NAME) : '',
  };
}

export function sameSettings(a: Settings, b: Settings): boolean {
  return (
    a.theme === b.theme &&
    a.boardOrientation === b.boardOrientation &&
    a.analysisDepth === b.analysisDepth &&
    a.playerName.trim() === b.playerName.trim()
  );
}

export async function fetchPreferences(client: SupabaseClient, userId: string): Promise<Settings | null> {
  const { data, error } = await client
    .from('user_preferences')
    .select('theme, board_orientation, analysis_depth, player_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSettings(data) : null;
}

export async function savePreferences(client: SupabaseClient, userId: string, settings: Settings): Promise<void> {
  const { error } = await client
    .from('user_preferences')
    .upsert({ ...settingsToRow(settings, userId), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export interface CloudProgressInfo {
  updatedAt: string;
}

export async function fetchCloudProgressInfo(client: SupabaseClient, userId: string): Promise<CloudProgressInfo | null> {
  const { data, error } = await client.from('user_progress').select('updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data && typeof data.updated_at === 'string' ? { updatedAt: data.updated_at } : null;
}

export async function uploadProgress(client: SupabaseClient, userId: string, backup: BackupFile): Promise<void> {
  const { error } = await client
    .from('user_progress')
    .upsert({ user_id: userId, data: backup, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Restituisce il backup grezzo: va sempre validato con `validateBackup` prima dell'uso. */
export async function downloadProgress(client: SupabaseClient, userId: string): Promise<unknown | null> {
  const { data, error } = await client.from('user_progress').select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? (data as { data: unknown }).data : null;
}
