-- RLS test for the PROPOSED couple_id check (supabase/proposed_migrations/20260108...).
-- LOCAL database only. The proposed migration is applied inside the same transaction
-- and everything is rolled back, so nothing is left behind:
--
--   { echo 'begin;'
--     cat supabase/proposed_migrations/20260108000000_require_couple_membership_on_transaction_write.sql
--     cat supabase/tests/couple_insert_rls.sql
--   } | docker exec -i supabase_db_Nina psql -U postgres -d postgres -v ON_ERROR_STOP=1
--
-- Users: K1 and K2 form couple 1; K3 is in couple 2; K4 is in no couple.
-- (The caller supplies `begin;` and the migration first; this file ends with rollback.)

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'rls-k1@test.local'),
  ('00000000-0000-4000-8000-0000000000f2', 'rls-k2@test.local'),
  ('00000000-0000-4000-8000-0000000000f3', 'rls-k3@test.local'),
  ('00000000-0000-4000-8000-0000000000f4', 'rls-k4@test.local');

insert into public.couples (id, code, user_1_id, user_2_id) values
  ('00000000-0000-4000-8000-0000000000c1', 'TESTC1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2'),
  ('00000000-0000-4000-8000-0000000000c2', 'TESTC2', '00000000-0000-4000-8000-0000000000f3', null);

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- 1) K1 inserts a personal row (couple_id null): allowed.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
insert into public.transactions (user_id, type, amount, category, date)
values ('00000000-0000-4000-8000-0000000000f1', 'expense', 1, 'other', '2026-10-05');
do $$ begin raise notice 'ok: K1 inserts a personal row'; end $$;

-- 2) K1 inserts into their own couple: allowed.
insert into public.transactions (user_id, type, amount, category, date, couple_id)
values ('00000000-0000-4000-8000-0000000000f1', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000c1');
do $$ begin raise notice 'ok: K1 inserts into couple 1 (member)'; end $$;

-- 3) K2, the other member, can too.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
insert into public.transactions (user_id, type, amount, category, date, couple_id)
values ('00000000-0000-4000-8000-0000000000f2', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000c1');
do $$ begin raise notice 'ok: K2 inserts into couple 1 (member)'; end $$;

-- 4) K3 (couple 2) cannot write into couple 1.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f3');
do $$
begin
  insert into public.transactions (user_id, type, amount, category, date, couple_id)
  values ('00000000-0000-4000-8000-0000000000f3', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000c1');
  raise exception 'RLS FAIL: K3 inserted into a couple it does not belong to';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: K3 cannot insert into couple 1';
end $$;

-- 5) K4 (no couple) cannot either.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f4');
do $$
begin
  insert into public.transactions (user_id, type, amount, category, date, couple_id)
  values ('00000000-0000-4000-8000-0000000000f4', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000c1');
  raise exception 'RLS FAIL: K4 inserted into a couple it does not belong to';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: K4 cannot insert into couple 1';
end $$;

-- 6) K3 cannot move an existing row of theirs into couple 1 (UPDATE).
reset role;
insert into public.transactions (id, user_id, type, amount, category, date)
values ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000f3', 'expense', 1, 'other', '2026-10-05');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f3');
do $$
begin
  update public.transactions set couple_id = '00000000-0000-4000-8000-0000000000c1'
  where id = '00000000-0000-4000-8000-0000000000a9';
  raise exception 'RLS FAIL: K3 moved a row into couple 1';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: K3 cannot move a row into couple 1';
end $$;

reset role;
rollback;
