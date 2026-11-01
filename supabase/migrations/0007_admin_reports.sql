create table public.admin_snapshots (
  day date not null,
  user_id uuid not null references auth.users on delete cascade,
  xp integer not null default 0,
  levels_done smallint not null default 0,
  rules_done smallint not null default 0,
  tsume_solved integer not null default 0,
  games integer not null default 0,
  wins integer not null default 0,
  primary key (day, user_id)
);
alter table public.admin_snapshots enable row level security;
revoke all on public.admin_snapshots from anon, authenticated;

create table public.admin_alerts (
  user_id uuid primary key references auth.users on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from anon, authenticated;
insert into public.admin_alerts (user_id) select id from public.profiles on conflict do nothing;

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
