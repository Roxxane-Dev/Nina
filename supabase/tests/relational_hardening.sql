-- Test for 20261103000000_relational_hardening.sql. Run on the LOCAL database:
--   docker exec -i supabase_db_Nina psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/relational_hardening.sql
-- Runs inside a transaction that is rolled back.

begin;

-- Sign-up still creates the profile through the trigger. Local databases do not have the production
-- trigger on auth.users (the baseline only covers public), so it is created here, then rolled back.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'hard-d1@test.local');
do $$
begin
  if not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'FAIL: the sign-up trigger no longer creates the profile';
  end if;
  raise notice 'ok: sign-up trigger creates the profile';
end $$;

-- A goal or message needs a real user.
do $$
begin
  insert into public.goals (user_id, name, target_amount) values ('00000000-0000-4000-8000-0000000000d9', 'x', 1);
  raise exception 'FAIL: a goal without a user was accepted';
exception when foreign_key_violation then
  raise notice 'ok: goal needs a real user';
end $$;

do $$
begin
  insert into public.messages (user_id, role, content) values ('00000000-0000-4000-8000-0000000000d9', 'user', 'x');
  raise exception 'FAIL: a message without a user was accepted';
exception when foreign_key_violation then
  raise notice 'ok: message needs a real user';
end $$;

-- Deleting a user takes their goals and messages.
insert into public.goals (id, user_id, name, target_amount) values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d1', 'x', 1);
insert into public.messages (user_id, role, content) values ('00000000-0000-4000-8000-0000000000d1', 'user', 'x');
delete from auth.users where id = '00000000-0000-4000-8000-0000000000d1';
do $$
begin
  if exists (select 1 from public.goals where id = '00000000-0000-4000-8000-0000000000d2')
     or exists (select 1 from public.messages where user_id = '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'FAIL: rows survived the user';
  end if;
  raise notice 'ok: rows cascade with the user';
end $$;

-- Nobody can call the trigger function through the API.
do $$
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'execute')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') then
    raise exception 'FAIL: handle_new_user is still callable';
  end if;
  raise notice 'ok: handle_new_user is not callable through the API';
end $$;

rollback;
