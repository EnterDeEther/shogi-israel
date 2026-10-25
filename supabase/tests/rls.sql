-- Row-level security check: run as the postgres user; everything is rolled back. Expect every 'blocked'/0 below.
begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','a@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b2','b@test.local','authenticated','authenticated');
create temp table results(test text, outcome text);
grant all on results to anon, authenticated;
-- user A
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
insert into profiles(id,nickname) values ('00000000-0000-0000-0000-0000000000a1','UserA');
insert into progress(user_id,data) values ('00000000-0000-0000-0000-0000000000a1','{"rules":["x"]}');
insert into games(user_id,opponent,result) values ('00000000-0000-0000-0000-0000000000a1','ai','win');
do $$ begin begin insert into profiles(id,nickname) values ('00000000-0000-0000-0000-0000000000b2','Spoof'); insert into results values('A creates B profile','ALLOWED'); exception when others then insert into results values('A creates B profile','blocked: '||sqlstate); end; end $$;
do $$ begin begin update profiles set rating=3000 where id='00000000-0000-0000-0000-0000000000a1'; insert into results values('A sets own rating','ALLOWED'); exception when others then insert into results values('A sets own rating','blocked: '||sqlstate); end; end $$;
do $$ begin begin insert into profiles(id,nickname) values ('00000000-0000-0000-0000-0000000000a1','admin1'); exception when others then insert into results values('reserved nickname','blocked: '||sqlstate); end; end $$;
do $$ begin begin insert into games(user_id,opponent,result) values ('00000000-0000-0000-0000-0000000000b2','ai','win'); insert into results values('A logs game for B','ALLOWED'); exception when others then insert into results values('A logs game for B','blocked: '||sqlstate); end; end $$;
-- user B
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',true);
insert into results select 'B reads A progress rows', count(*)::text from progress;
insert into results select 'B reads A games rows', count(*)::text from games;
insert into results select 'B sees public nicknames', count(*)::text from profiles;
update progress set data='{}' where user_id='00000000-0000-0000-0000-0000000000a1';
do $$ begin begin update profiles set nickname='Hacked' where id='00000000-0000-0000-0000-0000000000a1'; exception when others then null; end; end $$;
-- anon
reset role; set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin begin perform count(*) from progress; insert into results values('anon reads progress','ALLOWED'); exception when others then insert into results values('anon reads progress','blocked: '||sqlstate); end; end $$;
do $$ begin begin perform delete_my_account(); insert into results values('anon delete fn','ALLOWED'); exception when others then insert into results values('anon delete fn','blocked: '||sqlstate); end; end $$;
insert into results select 'anon community counts (totals only: 1, 1, 1)', community_counts()::text;
reset role;
insert into results select 'A progress after B tamper', data::text from progress where user_id='00000000-0000-0000-0000-0000000000a1';
insert into results select 'A nickname after B tamper', nickname from profiles where id='00000000-0000-0000-0000-0000000000a1';
insert into results select 'A rating', rating::text from profiles where id='00000000-0000-0000-0000-0000000000a1';
select * from results;
rollback;
