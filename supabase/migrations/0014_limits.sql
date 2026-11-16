alter table public.notices drop constraint notices_url_ours;
alter table public.notices
  add constraint notices_url_ours check (url is null or (strpos(url, chr(92)) = 0 and (url ~ '^/([^/\s"<>][^\s"<>]*)?$'
    or url ~ '^https://(www\.)?(shogi\.co\.il|instagram\.com|facebook\.com|chat\.whatsapp\.com|lishogi\.org)(/[^\s"<>]*)?$')));

create function public.games_cap() returns trigger
  language plpgsql set search_path = ''
  as $$
  begin
    if (select count(*) from public.games g where g.user_id = new.user_id) >= 1000 then
      return null;
    end if;
    return new;
  end;
  $$;
revoke execute on function public.games_cap() from public, anon, authenticated;

create trigger games_cap before insert on public.games
  for each row execute function public.games_cap();
