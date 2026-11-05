create table public.open_games (
  user_id uuid not null references auth.users on delete cascade,
  mode text not null check (mode in ('ai', 'local')),
  data jsonb not null check (octet_length(data::text) < 100000),
  at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

alter table public.open_games enable row level security;
create policy "read own open games" on public.open_games for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.open_games from anon, authenticated;
grant select on public.open_games to authenticated;

create function public.save_open_game(p_mode text, p_data jsonb, p_at bigint) returns boolean
  language plpgsql security definer set search_path = ''
  as $$
declare
  uid uuid := (select auth.uid());
  n int;
begin
  if uid is null then return false; end if;
  insert into public.open_games as g (user_id, mode, data, at, updated_at)
    values (uid, p_mode, p_data, p_at, now())
    on conflict (user_id, mode) do update
      set data = excluded.data, at = excluded.at, updated_at = now()
      where g.at < excluded.at;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke execute on function public.save_open_game(text, jsonb, bigint) from public, anon;
grant execute on function public.save_open_game(text, jsonb, bigint) to authenticated;
