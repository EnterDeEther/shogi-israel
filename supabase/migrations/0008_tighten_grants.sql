-- Removes table rights nobody uses. Row Level Security already blocks these (there is no delete policy on
-- profiles or progress), so nothing changes for players; this is a second lock in case a policy is ever added by mistake.
-- Deleting an account still works: delete_my_account() runs as the owner and the rows go with the user (on delete cascade).

-- Supabase's default grants left DELETE on profiles to signed-out visitors (anon) and to players.
revoke delete on public.profiles from anon, authenticated;

-- Players never delete their progress row directly (signing out only clears this device).
revoke delete on public.progress from authenticated;
