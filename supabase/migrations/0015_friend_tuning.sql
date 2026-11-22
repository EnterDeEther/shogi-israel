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

alter table public.friend_games alter column created_by drop not null;
alter table public.friend_games drop constraint friend_games_created_by_fkey;
alter table public.friend_games add constraint friend_games_created_by_fkey
  foreign key (created_by) references auth.users on delete set null;

alter table public.push_subscriptions add column push_turn boolean not null default false;

alter table public.notification_prefs add column email_turn boolean not null default false;
alter table public.notification_prefs add column email_turn_at timestamptz;

create function public.set_email_turn(turn_on boolean) returns void
  language plpgsql security definer set search_path = ''
  as $$
  declare uid uuid := (select auth.uid());
  begin
    if uid is null then raise exception 'not signed in'; end if;
    insert into public.notification_prefs as p (user_id, email_turn, email_turn_at)
      values (uid, turn_on, case when turn_on then now() end)
    on conflict (user_id) do update set
      email_turn = excluded.email_turn,
      email_turn_at = case when excluded.email_turn and not p.email_turn then now() else p.email_turn_at end,
      paused_reason = case when excluded.email_turn then null else p.paused_reason end,
      updated_at = now();
  end;
  $$;
revoke execute on function public.set_email_turn(boolean) from public, anon;
grant execute on function public.set_email_turn(boolean) to authenticated;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in ('week', 'return', 'unsubscribe', 'turn'));
alter table public.email_log add column game_id uuid references public.friend_games on delete set null;

create table public.blocked_words (
  word text primary key check (length(word) between 2 and 30),
  whole boolean not null default false
);
alter table public.blocked_words enable row level security;
revoke all on public.blocked_words from anon, authenticated;

create function public.plain_name(name text) returns text
  language sql immutable set search_path = ''
  as $$
    select regexp_replace(translate(lower(name), '013457ךםןףץ_-', 'oieastכמנפצ'), '(.)\1+', '\1', 'g');
  $$;

create function public.profiles_name_guard() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  plain text := public.plain_name(new.nickname);
begin
  if new.nickname ~ '[0-9]{7,}' or exists (
    select 1 from public.blocked_words w
    where case when w.whole then plain = w.word else position(w.word in plain) > 0 end
  ) then
    raise exception 'nickname not allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger profiles_name_guard before insert or update of nickname on public.profiles
  for each row execute function public.profiles_name_guard();
revoke execute on function public.profiles_name_guard() from public, anon, authenticated;
revoke execute on function public.plain_name(text) from public, anon, authenticated;
