-- 002_expenses.sql
-- Table for storing user expenses in Nina.

-- 1. Create the table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, -- Links to auth.users.id
  amount numeric(12,2) not null,
  category text not null default 'other',
  description text,
  date date not null default current_date,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS)
-- This ensures users can't see each other's expenses if they access Supabase directly.
-- Note: Our Admin client in NestJS bypasses this, but it's best practice for security.
alter table public.expenses enable row level security;

-- 3. Create RLS Policies
create policy "Users can view their own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own expenses"
  on public.expenses for update
  using (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

-- 4. Create Indexes for performance
-- We often filter by user_id and sort/filter by date.
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_date_idx on public.expenses (date desc);
create index if not exists expenses_category_idx on public.expenses (category);

-- 5. Foreign Key (Optional but recommended)
-- Only add this if you want strict referential integrity with Supabase Auth.
-- alter table public.expenses 
--   add constraint expenses_user_id_fkey 
--   foreign key (user_id) 
--   references auth.users(id) 
--   on delete cascade;
