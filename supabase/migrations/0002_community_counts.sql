-- Totals for the community page (/community/): how many players have an account, how many practised
-- this week, and how many games against the computer were played this week. Counts only, never who,
-- so signed-out visitors may call it too. Run once in the Supabase SQL editor, after 0001.
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
