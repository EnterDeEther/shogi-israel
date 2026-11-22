alter table public.friend_games add column if not exists inviter_rest boolean not null default false;
alter table public.friend_games add column if not exists sente_rest boolean not null default false;
alter table public.friend_games add column if not exists gote_rest boolean not null default false;
alter table public.friend_games add column if not exists sente_name text check (length(sente_name) <= 32);
alter table public.friend_games add column if not exists gote_name text check (length(gote_name) <= 32);

create or replace function public.profiles_name_guard() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  plain text := public.plain_name(new.nickname);
begin
  if length(regexp_replace(new.nickname, '[^0-9]', '', 'g')) >= 7 or exists (
    select 1 from public.blocked_words w
    where case when w.whole then plain = w.word else position(w.word in plain) > 0 end
  ) then
    raise exception 'nickname not allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_name_guard() from public, anon, authenticated;
