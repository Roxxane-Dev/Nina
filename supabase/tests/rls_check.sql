-- RLS audit: run in the SQL editor of the DEV project after applying migrations.
-- Expected result of query 1: zero rows.

-- 1. Public tables with RLS disabled
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by 1;

-- 2. Policies per table (review that each user-owned table filters by auth.uid())
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
