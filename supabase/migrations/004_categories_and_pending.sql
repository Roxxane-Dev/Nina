-- 004_categories_and_pending.sql
-- Creates the categories, user_categories, and pending_expenses tables.

-- ─── 1. System-wide category definitions ─────────────────────────────────────
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,   -- machine key: 'food', 'transport', …
  name            text not null,           -- shown to user: 'Comida', 'Transporte', …
  emoji           text,
  is_system       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- System categories seed (idempotent)
insert into public.categories (normalized_name, name, emoji, is_system) values
  ('food',          'Comida',           '🍔', true),
  ('transport',     'Transporte',       '🚌', true),
  ('home',          'Hogar/Renta',      '🏠', true),
  ('health',        'Salud',            '💊', true),
  ('entertainment', 'Entretenimiento',  '🎬', true),
  ('shopping',      'Compras',          '🛍️', true),
  ('other',         'Otros',            '📦', true)
on conflict (normalized_name) do nothing;

-- ─── 2. Update expenses table to reference category_id ───────────────────────
-- Only add column if not already there (safe to re-run)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'expenses'
      and column_name  = 'category_id'
  ) then
    alter table public.expenses add column category_id uuid references public.categories(id);
  end if;
end;
$$;

-- Back-fill category_id from the old text `category` column if it exists
update public.expenses e
set    category_id = c.id
from   public.categories c
where  e.category_id is null
  and  e.category    = c.normalized_name;

-- ─── 3. Pending expenses (confirmation queue) ─────────────────────────────────
create table if not exists public.pending_expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  payload    jsonb not null,              -- array of resolved expense objects
  status     text not null default 'pending'
               check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists pending_expenses_user_id_status_idx
  on public.pending_expenses (user_id, status);

-- RLS: users see only their own pending rows
alter table public.pending_expenses enable row level security;

create policy "Users see own pending" on public.pending_expenses
  for select using (auth.uid() = user_id);
