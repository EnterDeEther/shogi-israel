create table public.friend_labels (
  user_id uuid not null references auth.users on delete cascade,
  game_id uuid not null references public.friend_games on delete cascade,
  label text not null check (char_length(label) between 1 and 30),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index friend_labels_game_idx on public.friend_labels (game_id);
alter table public.friend_labels enable row level security;
revoke all on public.friend_labels from anon, authenticated;
