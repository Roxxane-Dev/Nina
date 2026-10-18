-- 012_profiles_spaces.sql
-- User display profile + couple space link for Home space selector.

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  email               text,
  current_couple_id   uuid,
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create index if not exists profiles_couple_id_idx on public.profiles (current_couple_id);
