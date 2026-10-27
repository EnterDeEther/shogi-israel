-- Saving progress is an upsert (insert ... on conflict do update), and PostgREST's upsert sets every column it
-- sends, user_id included. Without UPDATE on user_id every save failed with "permission denied". The row
-- still can't change hands: the "save own progress" policy checks user_id = auth.uid() before and after.
grant update (user_id) on public.progress to authenticated;
