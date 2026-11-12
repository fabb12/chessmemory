-- ChessMemoryBen: account utente con Supabase.
-- Esegui questo script una volta nel tuo progetto (SQL Editor oppure `supabase db push`).
--
-- Ogni utente può leggere e scrivere solo le proprie righe (Row Level Security).
-- La chiave «anon» usata dall'app è pubblica: la protezione dei dati è affidata a queste regole.

-- ───────────── Preferenze ─────────────
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  board_orientation text not null default 'auto' check (board_orientation in ('auto', 'white', 'black')),
  analysis_depth text not null default 'quick' check (analysis_depth in ('quick', 'deep')),
  player_name text not null default '' check (char_length(player_name) <= 60),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Preferenze: lettura propria" on public.user_preferences;
create policy "Preferenze: lettura propria" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Preferenze: inserimento proprio" on public.user_preferences;
create policy "Preferenze: inserimento proprio" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Preferenze: modifica propria" on public.user_preferences;
create policy "Preferenze: modifica propria" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Preferenze: cancellazione propria" on public.user_preferences;
create policy "Preferenze: cancellazione propria" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ───────────── Progressi (backup JSON, senza foto) ─────────────
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  -- Limite di sicurezza: circa 5 MB di JSON.
  constraint user_progress_size check (pg_column_size(data) <= 5 * 1024 * 1024)
);

alter table public.user_progress enable row level security;

drop policy if exists "Progressi: lettura propria" on public.user_progress;
create policy "Progressi: lettura propria" on public.user_progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Progressi: inserimento proprio" on public.user_progress;
create policy "Progressi: inserimento proprio" on public.user_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Progressi: modifica propria" on public.user_progress;
create policy "Progressi: modifica propria" on public.user_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Progressi: cancellazione propria" on public.user_progress;
create policy "Progressi: cancellazione propria" on public.user_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.user_progress to authenticated;
