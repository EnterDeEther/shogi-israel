create table if not exists public.friend_bugs (
  id bigint generated always as identity primary key,
  game_id uuid references public.friend_games on delete set null,
  side text check (side in ('sente', 'gote')),
  signed boolean not null default false,
  kind text not null check (kind in ('move', 'sync', 'join', 'link', 'alert', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  context text not null default '' check (char_length(context) <= 300),
  agent text not null default '' check (char_length(agent) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists friend_bugs_created_at on public.friend_bugs (created_at);
create index if not exists friend_bugs_game on public.friend_bugs (game_id);

alter table public.friend_bugs enable row level security;
revoke all on public.friend_bugs from anon, authenticated;
