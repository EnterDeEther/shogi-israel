revoke select on public.profiles from anon, authenticated;
grant select (nickname, rating) on public.profiles to anon;
grant select (id, nickname, rating) on public.profiles to authenticated;
