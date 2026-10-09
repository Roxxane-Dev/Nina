-- 010_transactions_incomes_goals.sql
-- Creates missing tables and fixes ai_insights column gaps.

-- ─────────────────────────── INCOMES ─────────────────────────────────────────
create table if not exists public.incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  amount      numeric(12,2) not null,
  description text,
  category    text not null default 'salary',
  date        date not null default current_date,
  source      text not null default 'chat',
  created_at  timestamptz not null default now()
);

alter table public.incomes enable row level security;

create policy "Users see own incomes"
  on public.incomes for select using (auth.uid() = user_id);

create policy "Users insert own incomes"
  on public.incomes for insert with check (auth.uid() = user_id);

create policy "Users update own incomes"
  on public.incomes for update using (auth.uid() = user_id);

create policy "Users delete own incomes"
  on public.incomes for delete using (auth.uid() = user_id);

create index if not exists incomes_user_id_idx on public.incomes (user_id);
create index if not exists incomes_date_idx    on public.incomes (date desc);

-- ─────────────────────────── GOALS ───────────────────────────────────────────
create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  name            text not null,
  emoji           text default '🎯',
  target_amount   numeric(12,2) not null,
  current_amount  numeric(12,2) not null default 0,
  deadline        date,
  status          text not null default 'active'
                  check (status in ('active', 'completed', 'paused')),
  created_at      timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users see own goals"
  on public.goals for select using (auth.uid() = user_id);

create policy "Users insert own goals"
  on public.goals for insert with check (auth.uid() = user_id);

create policy "Users update own goals"
  on public.goals for update using (auth.uid() = user_id);

create index if not exists goals_user_id_idx on public.goals (user_id);

-- ─────────────────────────── TRANSACTIONS (ledger) ───────────────────────────
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  type            text not null check (type in ('income','expense','transfer','subscription')),
  amount          numeric(12,2) not null,
  description     text,
  category        text not null default 'other',
  date            date not null default current_date,
  source_table    text,  -- 'expenses' | 'incomes'
  source_id       uuid,  -- FK to original row
  space_id        text not null default 'personal', -- 'personal' | 'pareja'
  created_at      timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users see own transactions"
  on public.transactions for select using (auth.uid() = user_id);

create policy "Users insert own transactions"
  on public.transactions for insert with check (auth.uid() = user_id);

create index if not exists transactions_user_id_idx  on public.transactions (user_id);
create index if not exists transactions_date_idx     on public.transactions (date desc);
create index if not exists transactions_type_idx     on public.transactions (type);
create index if not exists transactions_space_id_idx on public.transactions (space_id);

-- ─────────────────────────── SPACES (Espacios) ────────────────────────────────
create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,
  name        text not null,
  type        text not null default 'personal' check (type in ('personal','pareja','familia','negocio')),
  emoji       text default '💰',
  members     jsonb default '[]',
  created_at  timestamptz not null default now()
);

alter table public.spaces enable row level security;

create policy "Users see own spaces"
  on public.spaces for select using (auth.uid() = owner_id);

create policy "Users insert own spaces"
  on public.spaces for insert with check (auth.uid() = owner_id);

create index if not exists spaces_owner_id_idx on public.spaces (owner_id);

-- ─────────────────────────── AI_INSIGHTS — add missing columns ───────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ai_insights' and column_name='type'
  ) then
    alter table public.ai_insights add column type text default 'insight';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ai_insights' and column_name='is_dismissed'
  ) then
    alter table public.ai_insights add column is_dismissed boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ai_insights' and column_name='action_label'
  ) then
    alter table public.ai_insights add column action_label text default 'Ver más';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ai_insights' and column_name='behavioral_tags'
  ) then
    alter table public.ai_insights add column behavioral_tags jsonb default '[]';
  end if;
end;
$$;

-- ─────────────────────────── SUBSCRIPTIONS — fix user_id ─────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscriptions' and column_name='user_id'
  ) then
    alter table public.subscriptions add column user_id uuid;
    -- backfill from owner_id if that column exists
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='owner_id'
    ) then
      update public.subscriptions set user_id = owner_id where user_id is null;
    end if;
  end if;
end;
$$;

-- ─────────────────────────── INTELLIGENCE_SNAPSHOTS ──────────────────────────
create table if not exists public.intelligence_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  snapshot_type text not null default 'home_intelligence',
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

alter table public.intelligence_snapshots enable row level security;

create policy "Users see own snapshots"
  on public.intelligence_snapshots for select using (auth.uid() = user_id);

create index if not exists snapshots_user_id_type_idx
  on public.intelligence_snapshots (user_id, snapshot_type, created_at desc);

-- ─────────────────────────── BACKFILL transactions ───────────────────────────
-- Convert existing expenses → transactions ledger
insert into public.transactions (user_id, type, amount, description, category, date, source_table, source_id, space_id)
select
  e.user_id,
  'expense'::text,
  e.amount,
  coalesce(e.description, e.category),
  coalesce(e.category, 'other'),
  e.date,
  'expenses',
  e.id,
  'personal'
from public.expenses e
where not exists (
  select 1 from public.transactions t
  where t.source_table = 'expenses' and t.source_id = e.id
);
