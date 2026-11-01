create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  user_id uuid references auth.users on delete cascade,
  gender char(1) not null default 'm' check (gender in ('m', 'f')),
  push_week boolean not null default false,
  push_course boolean not null default false,
  push_news boolean not null default false,
  last_push_at timestamptz,
  week_sent integer,
  course_sent smallint not null default 0,
  course_at timestamptz,
  news_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
