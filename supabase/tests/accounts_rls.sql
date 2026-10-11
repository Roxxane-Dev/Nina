-- RLS test for accounts (US-41). Run in the DEV SQL editor AFTER migrations
-- 013, 017 and 019. Runs inside a transaction that is rolled back.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'rls-d1@test.local'),
  ('00000000-0000-4000-8000-0000000000d2', 'rls-d2@test.local');

insert into public.accounts (id, user_id, name, kind) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'BCP sueldo', 'bank');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- D2 cannot see D1's account.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
do $$
begin
  if (select count(*) from public.accounts) <> 0 then
    raise exception 'RLS FAIL: D2 sees another user''s account';
  end if;
  raise notice 'ok: D2 cannot see D1 accounts';
end $$;

-- D2 cannot tag a movement with D1's account.
do $$
begin
  insert into public.transactions (user_id, type, amount, category, date, account_id)
  values ('00000000-0000-4000-8000-0000000000d2', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000e1');
  raise exception 'RLS FAIL: D2 used an account it does not own';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: D2 cannot use D1 account';
end $$;

-- D1 can.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
insert into public.transactions (user_id, type, amount, category, date, account_id)
values ('00000000-0000-4000-8000-0000000000d1', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000e1');
do $$ begin raise notice 'ok: D1 uses own account'; end $$;

reset role;
rollback;
