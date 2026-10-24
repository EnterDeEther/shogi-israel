-- Accounts for shogi.co.il: a public nickname, saved lesson progress, and a log of games for personal stats.
-- Run once in the Supabase SQL editor (or `supabase db push`). Every table has row-level security:
-- people read and write only their own rows; nicknames and ratings are public for leaderboards.

-- ---------- profiles: nickname (public) ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  -- 3–16 letters (Hebrew or Latin), digits, _ or -
  nickname text not null check (nickname ~ '^[A-Za-z0-9א-ת_-]{3,16}$'),
  -- set by the server only (future leaderboards); people cannot edit it
  rating integer not null default 1500,
  created_at timestamptz not null default now()
);
create unique index profiles_nickname_key on public.profiles (lower(nickname));

alter table public.profiles enable row level security;
create policy "nicknames are public" on public.profiles for select using (true);
create policy "create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "rename own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, nickname) on public.profiles to authenticated;
grant update (nickname) on public.profiles to authenticated;

-- ---------- progress: one JSON document per person ----------
-- { "learn": { "stages": { "<stage key>": { "scores": [3,2,…] } } }, "rules": ["01-board-pieces-setup", …] }
create table public.progress (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 65536),
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;
create policy "read own progress" on public.progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "create own progress" on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "save own progress" on public.progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- games: finished games, for personal stats (play vs AI writes here) ----------
create table public.games (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  opponent text not null check (opponent in ('ai')),  -- 'friend' arrives with invite-only PvP
  level smallint check (level between 1 and 20),
  color text check (color in ('sente', 'gote')),
  result text not null check (result in ('win', 'loss', 'draw', 'abort')),
  moves smallint check (moves between 0 and 1000),
  kif text check (length(kif) < 100000),
  played_at timestamptz not null default now()
);
create index games_user_idx on public.games (user_id, played_at desc);

alter table public.games enable row level security;
create policy "read own games" on public.games for select to authenticated using ((select auth.uid()) = user_id);
create policy "log own games" on public.games for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "delete own games" on public.games for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- delete my account (the "מחיקת החשבון" button) ----------
-- Removes the auth user; profiles, progress and games go with it (on delete cascade).
create function public.delete_my_account() returns void
  language sql security definer set search_path = ''
  as $$ delete from auth.users where id = (select auth.uid()); $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
