-- 011_unified_ledger_v2.sql
-- Budgets table (restored) + align transactions ledger with app inserts.

-- ─────────────────────────── BUDGETS ───────────────────────────────────────
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  category      text not null,
  limit_amount  numeric(12,2) not null,
  period        text not null default 'monthly'
                check (period in ('weekly', 'monthly', 'yearly')),
  created_at    timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "Users see own budgets"
  on public.budgets for select using (auth.uid() = user_id);

create policy "Users insert own budgets"
  on public.budgets for insert with check (auth.uid() = user_id);

create policy "Users update own budgets"
  on public.budgets for update using (auth.uid() = user_id);

create policy "Users delete own budgets"
  on public.budgets for delete using (auth.uid() = user_id);

create index if not exists budgets_user_id_idx on public.budgets (user_id);

-- Optional source column used by some clients (source_table remains canonical).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'source'
  ) then
    alter table public.transactions add column source text;
  end if;
end;
$$;
