-- 015_reconcile_transactions_date.sql
-- Makes the repo match the real database for transactions.date.
--
-- Migration 010 declared `date date`, but the DEV database has `timestamptz`
-- (changed outside migrations). The API writes calendar days ('2026-10-10'),
-- which Postgres stores as midnight UTC; the engine reads them back as that
-- calendar day (packages/finance-engine/src/timezone.ts).
--
-- Decision: keep timestamptz (what already exists; converting DEV back to
-- `date` would be a destructive schema change). On an environment created
-- from migrations (column still `date`), convert it so it behaves like DEV.
-- On DEV (already timestamptz) this is a no-op.
-- Not applied automatically: run it in the SQL editor when ready.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'date'
      and data_type = 'date'
  ) then
    -- A calendar day becomes midnight UTC of that day, exactly what the API
    -- writes today, so old and new rows follow the same convention.
    alter table public.transactions
      alter column date type timestamptz
      using (date::timestamp at time zone 'UTC');
    alter table public.transactions
      alter column date set default (current_date::timestamp at time zone 'UTC');
  end if;
end;
$$;
