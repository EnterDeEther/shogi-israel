create function public.community_counts() returns json
  language sql stable security definer set search_path = ''
  as $$
    select json_build_object(
      'players', (select count(*) from public.profiles),
      'active_week', (select count(*) from public.progress where updated_at > now() - interval '7 days'),
      'games_week', (select count(*) from public.games where played_at > now() - interval '7 days' and result <> 'abort')
    );
  $$;
revoke execute on function public.community_counts() from public;
grant execute on function public.community_counts() to anon, authenticated;
