-- RLS test for shared spaces (US-39). Run in the SQL editor of the DEV project
-- AFTER migrations 013 and 017. Everything runs inside a transaction that is
-- rolled back: it leaves no data behind. Any failed check raises an exception.
--
-- Users: A (owner of "Casa"), B (member), C (outsider).

begin;

-- Fixtures (as the service role / postgres).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.local'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.local'),
  ('00000000-0000-4000-8000-00000000000c', 'rls-c@test.local');

insert into public.spaces (id, name, type, owner_id) values
  ('00000000-0000-4000-8000-0000000000ff', 'Casa', 'pareja', '00000000-0000-4000-8000-00000000000a');
insert into public.space_members (space_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000ff', '00000000-0000-4000-8000-00000000000a', 'owner'),
  ('00000000-0000-4000-8000-0000000000ff', '00000000-0000-4000-8000-00000000000b', 'member');

insert into public.transactions (id, user_id, type, amount, category, description, date, shared_space_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'expense', 1200, 'home', 'alquiler', '2026-10-01', '00000000-0000-4000-8000-0000000000ff'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'expense', 80, 'food', 'personal de A', '2026-10-02', null),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', 'expense', 300, 'food', 'mercado casa', '2026-10-03', '00000000-0000-4000-8000-0000000000ff'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000b', 'expense', 45, 'entertainment', 'personal de B', '2026-10-04', null);

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.expect(label text, actual bigint, expected bigint) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'RLS FAIL: % (got %, expected %)', label, actual, expected;
  end if;
  raise notice 'ok: %', label;
end $$;

-- B sees: own 2 rows + A's shared row = 3; never A's personal row.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select pg_temp.expect('B sees shared + own rows', (select count(*) from public.transactions), 3);
select pg_temp.expect('B never sees A personal row',
  (select count(*) from public.transactions where id = '00000000-0000-4000-8000-0000000000a2'), 0);
select pg_temp.expect('B sees the space', (select count(*) from public.spaces), 1);
select pg_temp.expect('B sees both members', (select count(*) from public.space_members), 2);
select pg_temp.expect('B cannot read invites', (select count(*) from public.space_invites), 0);

-- C (outsider) sees nothing of the space.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select pg_temp.expect('C sees no transactions', (select count(*) from public.transactions), 0);
select pg_temp.expect('C sees no spaces', (select count(*) from public.spaces), 0);

-- C cannot inject a movement into the space.
do $$
begin
  insert into public.transactions (user_id, type, amount, category, date, shared_space_id)
  values ('00000000-0000-4000-8000-00000000000c', 'expense', 1, 'other', '2026-10-05', '00000000-0000-4000-8000-0000000000ff');
  raise exception 'RLS FAIL: C inserted into a space it does not belong to';
exception when insufficient_privilege or check_violation then
  raise notice 'ok: C cannot insert into the space';
end $$;

-- A sees own rows + B's shared row = 3; never B's personal row.
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select pg_temp.expect('A sees shared + own rows', (select count(*) from public.transactions), 3);
select pg_temp.expect('A never sees B personal row',
  (select count(*) from public.transactions where id = '00000000-0000-4000-8000-0000000000b2'), 0);

reset role;
rollback;
