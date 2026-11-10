create table public.friend_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]{10}$'),
  created_by uuid not null references auth.users on delete cascade,
  inviter_color text not null check (inviter_color in ('sente', 'gote', 'random')),
  rematch_of uuid references public.friend_games on delete set null,
  speed text not null check (speed in ('corr', 'live')),
  corr_days smallint check (corr_days in (1, 3)),
  clock_limit integer check (clock_limit between 60 and 7200),
  clock_byo integer check (clock_byo between 0 and 300),
  sente_user uuid references auth.users on delete set null,
  gote_user uuid references auth.users on delete set null,
  sente_guest text check (sente_guest ~ '^[0-9a-f]{64}$'),
  gote_guest text check (gote_guest ~ '^[0-9a-f]{64}$'),
  status text not null default 'open' check (status in ('open', 'active', 'finished', 'aborted', 'cancelled')),
  start_sfen text not null,
  moves text[] not null default '{}' check (cardinality(moves) <= 1000),
  ply integer not null default 0,
  sente_ms integer,
  gote_ms integer,
  turn_started_at timestamptz,
  move_deadline timestamptz,
  takeback_by text check (takeback_by in ('sente', 'gote')),
  rematch_by text check (rematch_by in ('sente', 'gote')),
  rematch_id uuid,
  signal jsonb check (octet_length(signal::text) < 300),
  winner text check (winner in ('sente', 'gote')),
  end_reason text check (end_reason in ('mate', 'stalemate', 'resign', 'time', 'repetition', 'perpetual', 'impasse', 'draw', 'abort')),
  kif text check (length(kif) < 100000),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  check (speed <> 'corr' or corr_days is not null),
  check (speed <> 'live' or (clock_limit is not null and clock_byo is not null))
);
create index friend_games_sente_idx on public.friend_games (sente_user, updated_at desc);
create index friend_games_gote_idx on public.friend_games (gote_user, updated_at desc);
create index friend_games_creator_idx on public.friend_games (created_by, status);

create table public.friend_blocks (
  user_id uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked),
  check (user_id <> blocked)
);

create table public.friend_reports (
  id bigint generated always as identity primary key,
  game_id uuid references public.friend_games on delete set null,
  reporter_user uuid references auth.users on delete set null,
  reporter_guest boolean not null default false,
  reported_user uuid references auth.users on delete set null,
  reason text not null check (reason in ('name', 'cheat', 'stall', 'other')),
  created_at timestamptz not null default now()
);

alter table public.friend_games enable row level security;
alter table public.friend_blocks enable row level security;
alter table public.friend_reports enable row level security;
revoke all on public.friend_games, public.friend_blocks, public.friend_reports from anon, authenticated;

create function public.friend_games_touch() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger friend_games_touch before update on public.friend_games
  for each row execute function public.friend_games_touch();

create function public.friend_games_ping() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  perform realtime.send(jsonb_build_object('ply', new.ply, 'status', new.status), 'changed', 'fg:' || new.id::text, false);
  return null;
exception when others then
  return null;
end;
$$;
create trigger friend_games_ping after update on public.friend_games
  for each row execute function public.friend_games_ping();

revoke execute on function public.friend_games_touch() from public, anon, authenticated;
revoke execute on function public.friend_games_ping() from public, anon, authenticated;
