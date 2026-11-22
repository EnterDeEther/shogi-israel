create or replace function public.friend_games_ping() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'ply', new.ply,
      'status', new.status,
      'usi', case when new.ply = old.ply + 1 then new.moves[new.ply] end,
      'deadline', floor(extract(epoch from new.move_deadline) * 1000),
      'prev', floor(extract(epoch from old.updated_at) * 1000),
      'rev', floor(extract(epoch from new.updated_at) * 1000)
    ),
    'changed', 'fg:' || new.id::text, false);
  return null;
exception when others then
  return null;
end;
$$;
revoke execute on function public.friend_games_ping() from public, anon, authenticated;

create table public.site_switches (
  name text primary key check (name ~ '^[a-z_]{1,40}$'),
  off boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.site_switches enable row level security;
revoke all on public.site_switches from anon, authenticated;
insert into public.site_switches (name) values ('friend_play');
