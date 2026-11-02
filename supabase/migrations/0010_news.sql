create or replace function public.news_form(t text, f boolean) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(t, '⟦([^|⟦⟧]*)\|([^|⟦⟧]*)⟧', case when f then '\2' else '\1' end, 'g'),
      '\*\*', '', 'g'),
    '\{[^{}]{1,2}\}', 'xx', 'g')
$$;

create or replace function public.news_len(t text) returns integer
language sql immutable set search_path = '' as $$
  select greatest(char_length(public.news_form(t, false)), char_length(public.news_form(t, true)))
$$;

create or replace function public.news_text_ok(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t !~ '[\r\n\t<>]'
    and public.news_form(t, false) !~ '[⟦⟧{}]'
    and (char_length(t) - char_length(replace(t, '**', ''))) / 2 in (0, 2)
$$;

alter table public.notices
  add column kind text not null default 'new' check (kind in ('new', 'content', 'changed', 'moved', 'fixed', 'important')),
  add column status text not null default 'draft' check (status in ('draft', 'waiting', 'published', 'archived')),
  add column cta_label text check (cta_label is null or (news_text_ok(cta_label) and news_len(cta_label) between 1 and 16)),
  add column source text not null default 'admin' check (source in ('claude', 'admin')),
  add column audience text not null default 'all' check (audience in ('all', 'returning', 'signed_in')),
  add column push boolean not null default false,
  add column in_email boolean not null default true,
  add column source_pr integer check (source_pr > 0),
  add column note text check (length(note) <= 300),
  add column updated_at timestamptz not null default now();

alter table public.notices drop constraint notices_url_check;
alter table public.notices
  add constraint notices_title_news check (news_text_ok(title) and news_len(title) between 1 and 70),
  add constraint notices_url_ours check (url is null or url ~ '^/([^/\s"<>][^\s"<>]*)?$'
    or url ~ '^https://(www\.)?(shogi\.co\.il|instagram\.com|facebook\.com|chat\.whatsapp\.com|lishogi\.org)(/[^\s"<>]*)?$'),
  add constraint notices_seven_days check (ends_at is null or (ends_at > starts_at and ends_at <= starts_at + interval '7 days')),
  add constraint notices_published_ends check (status <> 'published' or ends_at is not null);

create or replace function public.notices_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.starts_at := greatest(new.starts_at, now());
    new.ends_at := least(coalesce(new.ends_at, 'infinity'::timestamptz), new.starts_at + interval '7 days');
    if new.ends_at <= new.starts_at then new.ends_at := new.starts_at + interval '7 days'; end if;
  end if;
  return new;
end $$;

create trigger notices_stamp before insert or update on public.notices
  for each row execute function public.notices_stamp();

create index notices_live_idx on public.notices (status, starts_at desc);

drop policy "live notices are public" on public.notices;
create policy "published notices are public" on public.notices for select
  using (status = 'published' and starts_at <= now() and ends_at > now());

revoke all on public.notices from anon, authenticated;
grant select (id, kind, title, body, url, cta_label, audience, starts_at, ends_at) on public.notices to anon, authenticated;
