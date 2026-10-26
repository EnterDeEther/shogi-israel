-- Nicknames stay public, but the rest of a profile row does not need to be. Signed-out visitors may read only
-- nickname and rating; signed-in players also read id (the site looks up its own profile by it). Nobody reads
-- created_at through the API any more. Run once in the Supabase SQL editor, any time after 0001.
revoke select on public.profiles from anon, authenticated;
grant select (nickname, rating) on public.profiles to anon;
grant select (id, nickname, rating) on public.profiles to authenticated;
