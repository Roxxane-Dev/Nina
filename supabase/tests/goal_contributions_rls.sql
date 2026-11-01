-- RLS test for goal contributions and withdrawals (HOME-02, HOME-04). Run on the LOCAL database after
-- migrations 20261027000000_goal_contributions.sql and 20261101000000_goal_withdrawals.sql:
--   docker exec -i supabase_db_Nina psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/goal_contributions_rls.sql
-- Runs inside a transaction that is rolled back.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'rls-f1@test.local'),
  ('00000000-0000-4000-8000-0000000000f2', 'rls-f2@test.local');

insert into public.goals (id, user_id, name, target_amount, current_amount, status) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f1', 'Japón', 26250, 0, 'active');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- F2 cannot add to F1's goal.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
do $$
begin
  insert into public.transactions (user_id, type, amount, category, date, goal_id)
  values ('00000000-0000-4000-8000-0000000000f2', 'expense', 200, 'savings', '2026-10-27', '00000000-0000-4000-8000-0000000000a1');
  raise exception 'RLS FAIL: F2 linked a movement to another user''s goal';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: F2 cannot use F1 goal';
end $$;

-- F1 can add to its own goal.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
insert into public.transactions (id, user_id, type, amount, category, date, goal_id)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f1', 'expense', 200, 'savings', '2026-10-27', '00000000-0000-4000-8000-0000000000a1');
do $$ begin raise notice 'ok: F1 adds to own goal'; end $$;

-- A withdrawal (HOME-04) is a goal movement with type income, on the author's own goal.
insert into public.transactions (user_id, type, amount, category, date, goal_id)
values ('00000000-0000-4000-8000-0000000000f1', 'income', 50, 'savings', '2026-10-27', '00000000-0000-4000-8000-0000000000a1');
do $$ begin raise notice 'ok: F1 withdraws from own goal'; end $$;

-- F2 cannot withdraw from F1's goal.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
do $$
begin
  insert into public.transactions (user_id, type, amount, category, date, goal_id)
  values ('00000000-0000-4000-8000-0000000000f2', 'income', 50, 'savings', '2026-10-27', '00000000-0000-4000-8000-0000000000a1');
  raise exception 'RLS FAIL: F2 withdrew from another user''s goal';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: F2 cannot withdraw from F1 goal';
end $$;

-- F2 cannot see F1's contribution.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
do $$
begin
  if exists (select 1 from public.transactions where id = '00000000-0000-4000-8000-0000000000b1') then
    raise exception 'RLS FAIL: F2 sees F1 contribution';
  end if;
  raise notice 'ok: F2 cannot see F1 contribution';
end $$;

-- Deleting the goal keeps the movement (goal_id becomes null).
reset role;
delete from public.goals where id = '00000000-0000-4000-8000-0000000000a1';
do $$
begin
  if (select goal_id from public.transactions where id = '00000000-0000-4000-8000-0000000000b1') is not null then
    raise exception 'FK FAIL: goal_id should be set null';
  end if;
  raise notice 'ok: deleting a goal keeps the movement';
end $$;

rollback;
