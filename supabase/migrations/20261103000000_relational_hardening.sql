-- Relational hardening found while reviewing production (decision D-019).
-- Part of the active chain for local databases. NOT applied to production: see section 9 of
-- docs/PROD-MIGRATION-RUNBOOK.md.
--
-- goals and messages pointed at users by convention only. Production has no orphan rows, so the
-- foreign keys validate. They cascade like every other user-owned table.

alter table public.goals drop constraint if exists goals_user_id_fkey;
alter table public.goals add constraint goals_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.messages drop constraint if exists messages_user_id_fkey;
alter table public.messages add constraint messages_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- Every engine read filters by user and orders by date; these had no index on the user.
create index if not exists transactions_user_id_date_idx on public.transactions (user_id, date desc);
create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists ai_insights_user_id_idx on public.ai_insights (user_id);

-- handle_new_user only runs from the auth.users trigger: nobody should call it through the API.
-- A trigger does not need EXECUTE for the user who fires it, so sign-up keeps working.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Fixed search_path, as the Supabase security linter asks.
alter function public.handle_new_user() set search_path = public;
alter function public.create_user_profile() set search_path = public;
alter function public.match_messages(uuid, public.vector, integer) set search_path = public;
