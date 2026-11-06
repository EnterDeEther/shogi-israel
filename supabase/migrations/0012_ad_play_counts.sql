create table public.ad_play_counts (
  day date not null,
  campaign text not null,
  event text not null,
  level smallint not null default 0,
  n integer not null default 0,
  primary key (day, campaign, event, level)
);

alter table public.ad_play_counts enable row level security;
revoke all on public.ad_play_counts from anon, authenticated;

create function public.count_ad_play(p_campaign text, p_event text, p_level int default 0) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if p_campaign is null or p_campaign !~ '^[A-Za-z0-9_.-]{1,40}( / [A-Za-z0-9_.-]{1,40}){0,2}$' then return; end if;
  if p_event is null or p_event not in ('start', 'win', 'tour_skip', 'tour_part', 'tour_done', 'inapp_card', 'open_chrome') then return; end if;
  if p_level is null or p_level < 0 or p_level > 10 then return; end if;
  insert into public.ad_play_counts as c (day, campaign, event, level, n)
    values ((now() at time zone 'Asia/Jerusalem')::date, p_campaign, p_event, p_level, 1)
    on conflict (day, campaign, event, level) do update set n = c.n + 1;
end;
$$;

revoke execute on function public.count_ad_play(text, text, int) from public;
grant execute on function public.count_ad_play(text, text, int) to anon, authenticated;
