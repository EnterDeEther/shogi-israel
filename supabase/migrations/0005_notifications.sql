create table public.notices (
  id bigint generated always as identity primary key,
  title text not null check (length(title) between 1 and 120),
  body text check (length(body) <= 300),
  url text check (url ~ '^(/|https://)'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
create policy "live notices are public" on public.notices for select
  using (starts_at <= now() and (ends_at is null or ends_at > now()));
revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;

create table public.notification_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  email_week boolean not null default false,
  email_return boolean not null default false,
  consent_at timestamptz,
  consent_source text check (consent_source in ('signup', 'settings')),
  consent_version smallint,
  paused_reason text check (paused_reason in ('bounce', 'complaint')),
  last_seen_at timestamptz,
  return_sent smallint not null default 0,
  last_email_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "read own notification prefs" on public.notification_prefs for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;

create function public.set_email_prefs(week boolean, ret boolean, source text, version smallint) returns void
  language plpgsql security definer set search_path = ''
  as $$
  declare uid uuid := (select auth.uid());
  begin
    if uid is null then raise exception 'not signed in'; end if;
    if source not in ('signup', 'settings') then raise exception 'bad source'; end if;
    insert into public.notification_prefs as p (user_id, email_week, email_return, consent_at, consent_source, consent_version)
      values (uid, week, ret, case when week or ret then now() end, case when week or ret then source end, case when week or ret then version end)
    on conflict (user_id) do update set
      email_week = excluded.email_week,
      email_return = excluded.email_return,
      consent_at = case when (excluded.email_week and not p.email_week) or (excluded.email_return and not p.email_return) then now() else p.consent_at end,
      consent_source = case when (excluded.email_week and not p.email_week) or (excluded.email_return and not p.email_return) then source else p.consent_source end,
      consent_version = case when (excluded.email_week and not p.email_week) or (excluded.email_return and not p.email_return) then version else p.consent_version end,
      paused_reason = case when excluded.email_week or excluded.email_return then null else p.paused_reason end,
      updated_at = now();
  end;
  $$;
revoke execute on function public.set_email_prefs(boolean, boolean, text, smallint) from public, anon;
grant execute on function public.set_email_prefs(boolean, boolean, text, smallint) to authenticated;

create function public.touch_last_seen() returns void
  language sql security definer set search_path = ''
  as $$
    insert into public.notification_prefs (user_id, last_seen_at) values ((select auth.uid()), now())
    on conflict (user_id) do update set last_seen_at = now(), return_sent = 0;
  $$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

create table public.email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('week', 'return', 'unsubscribe')),
  sent_at timestamptz not null default now(),
  resend_id text
);
create index email_log_user_idx on public.email_log (user_id, sent_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
