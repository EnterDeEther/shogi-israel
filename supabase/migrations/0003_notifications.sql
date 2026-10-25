-- Notifications for shogi.co.il: site news for the bell in the header, and the opt-in email settings with proof
-- of consent (חוק התקשורת, section 30A: no email nudges without the player's explicit, prior consent).
-- Run once in the Supabase SQL editor, after 0002. The on-site notes themselves are worked out in the browser
-- from the progress the account already keeps (src/lib/inbox.ts); read marks ride along in progress.data.

-- ---------- notices: site news, shown in everyone's bell ----------
-- Written from the Supabase dashboard (Table editor) only; visitors read the live ones.
create table public.notices (
  id bigint generated always as identity primary key,
  title text not null check (length(title) between 1 and 120),
  body text check (length(body) <= 300),
  url text check (url ~ '^(/|https://)'),  -- a page on the site, or an https link
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
create policy "live notices are public" on public.notices for select
  using (starts_at <= now() and (ends_at is null or ends_at > now()));
revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;

-- ---------- notification_prefs: email settings + proof of consent, one row per player ----------
-- Every email kind is off until the player turns it on. People read their own row; changes go through
-- set_email_prefs() only, so the consent time and wording version are set by the server, never by the page.
create table public.notification_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  email_week boolean not null default false,    -- the weekly email: puzzle of the week + your next step
  email_return boolean not null default false,  -- "continue where you stopped" after a break (at most twice)
  consent_at timestamptz,                       -- when an email kind was last turned on
  consent_source text check (consent_source in ('signup', 'settings')),
  consent_version smallint,                     -- which wording of the consent checkbox was shown
  paused_reason text check (paused_reason in ('bounce', 'complaint')),  -- set by the server only
  last_seen_at timestamptz,                     -- last visit while signed in (touch_last_seen(), at most daily)
  return_sent smallint not null default 0,      -- "come back" emails sent since the last visit (0–2)
  last_email_at timestamptz,                    -- for the one-email-a-week cap
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "read own notification prefs" on public.notification_prefs for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;

-- Turn email kinds on or off. Turning one on records the consent (time, screen, wording) and clears a pause.
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

-- A signed-in visit: the "come back" emails start counting again from here. Cheap, called at most once a day.
create function public.touch_last_seen() returns void
  language sql security definer set search_path = ''
  as $$
    insert into public.notification_prefs (user_id, last_seen_at) values ((select auth.uid()), now())
    on conflict (user_id) do update set last_seen_at = now(), return_sent = 0;
  $$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- ---------- email_log: every nudge email sent (for the weekly cap, and as the record of what was sent) ----------
-- Server only: the email job (api/notify.ts) writes it with the service key; no visitor can read or write it.
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
