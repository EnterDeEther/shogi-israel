-- Reports for the site owner: an email on each new sign-up, and a daily and a weekly summary of who signed up,
-- who played and who moved up (sent by api/admin-report.ts). Run once, any time after 0005.
-- Both tables are server-only: no policies, and anon/authenticated get no rights at all, so only the
-- service role (the report job) reads or writes them. Nothing here is shown on the site.

-- ---------- admin_snapshots: each player's totals once a day, so a report can say who moved up ----------
create table public.admin_snapshots (
  day date not null,                 -- the day in Israel the snapshot was taken
  user_id uuid not null references auth.users on delete cascade,
  xp integer not null default 0,     -- course points (src/lib/xp.ts)
  levels_done smallint not null default 0,
  rules_done smallint not null default 0,
  tsume_solved integer not null default 0,
  games integer not null default 0,  -- finished games against the computer
  wins integer not null default 0,
  primary key (day, user_id)
);
alter table public.admin_snapshots enable row level security;
revoke all on public.admin_snapshots from anon, authenticated;

-- ---------- admin_alerts: which sign-ups were already announced, so a repeated ping never emails twice ----------
create table public.admin_alerts (
  user_id uuid primary key references auth.users on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from anon, authenticated;
-- players who signed up before this ran are not news
insert into public.admin_alerts (user_id) select id from public.profiles on conflict do nothing;

-- ---------- ping the report job when a new player picks a nickname (the last step of signing up) ----------
-- The ping carries no data: the job looks for nicknames not announced yet, so a fake ping sends nothing.
-- pg_net queues the request after the insert commits; if anything fails here the sign-up still goes through.
create extension if not exists pg_net;

create function public.ping_admin_signup() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
  begin
    perform net.http_post(
      url := 'https://shogi.co.il/api/admin-report',
      body := '{"event":"signup"}'::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
    return new;
  exception when others then
    return new;
  end;
  $$;
revoke execute on function public.ping_admin_signup() from public, anon, authenticated;

create trigger profiles_ping_admin after insert on public.profiles
  for each row execute function public.ping_admin_signup();
