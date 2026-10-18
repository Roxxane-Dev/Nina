-- 005_user_profiles.sql
-- Stores aggregated financial profile per user, refreshed after each expense confirmation.

create table if not exists public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  total_spent  numeric(14,2) not null default 0,
  top_category text,                        -- name of top spending category
  last_updated timestamptz not null default now(),
  insights     jsonb                         -- flexible blob for advanced summaries
);

-- Only the user themselves (or the service role) can read their profile
alter table public.user_profiles enable row level security;

create policy "Users read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

-- Index for quick lookup (usually a direct eq on id, but good hygiene)
create index if not exists user_profiles_id_idx on public.user_profiles (id);
