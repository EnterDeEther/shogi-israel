-- Push notifications for the installed app (opt-in, one row per phone). Run once in the Supabase SQL editor, after 0005.
-- A row exists only while the player has at least one kind turned on; turning them all off deletes it. Nothing here is
-- readable or writable from the browser: the page talks to /api/push, which uses the service key (api/push.ts), and
-- the daily job (api/notify.ts → src/lib/push-send.ts) sends them. Who gets what is decided in src/lib/push.ts.
create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1000),  -- the phone's push address
  p256dh text not null check (length(p256dh) <= 200),   -- the phone's keys, to encrypt what we send
  auth text not null check (length(auth) <= 100),
  user_id uuid references auth.users on delete cascade, -- set when the app is signed in (needed for the course reminder)
  gender char(1) not null default 'm' check (gender in ('m', 'f')),
  push_week boolean not null default false,             -- the puzzle of the week, Sunday evening
  push_course boolean not null default false,           -- your next step on the path, after a few days away (signed in)
  push_news boolean not null default false,             -- news from Shogi Israel (a new row in public.notices)
  last_push_at timestamptz,                             -- at most one push a day
  week_sent integer,                                    -- the week number of the last puzzle-of-the-week push
  course_sent smallint not null default 0,              -- course reminders since the last visit (0–3)
  course_at timestamptz,                                -- when the last course reminder went
  news_after timestamptz not null default now(),        -- news that went live after this time is still to send
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
