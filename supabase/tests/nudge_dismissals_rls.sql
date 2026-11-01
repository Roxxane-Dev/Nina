-- RLS test for nudge dismissals (NOTIF-01). Run on the LOCAL database:
--   docker exec -i supabase_db_Nina psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/nudge_dismissals_rls.sql
-- Runs inside a transaction that is rolled back.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'rls-e1@test.local'),
  ('00000000-0000-4000-8000-0000000000e2', 'rls-e2@test.local');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');
insert into public.nudge_dismissals (user_id, nudge_key) values ('00000000-0000-4000-8000-0000000000e1', 'weekend:2026-11-06');
do $$ begin raise notice 'ok: E1 dismisses its own nudge'; end $$;

reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000e2');
do $$
begin
  if exists (select 1 from public.nudge_dismissals) then
    raise exception 'RLS FAIL: E2 sees E1 dismissals';
  end if;
  raise notice 'ok: E2 cannot see E1 dismissals';
end $$;

do $$
begin
  insert into public.nudge_dismissals (user_id, nudge_key) values ('00000000-0000-4000-8000-0000000000e1', 'forged');
  raise exception 'RLS FAIL: E2 wrote a dismissal for E1';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: E2 cannot write for E1';
end $$;

rollback;
