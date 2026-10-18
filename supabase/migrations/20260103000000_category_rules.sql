-- 016_category_rules.sql
-- US-24: when a user corrects a movement's category, Nina remembers it for
-- similar descriptions ("almuerzo en tambo" → food).
-- `pattern` is normalized by the engine (normalizeRulePattern): lowercase,
-- no accents, digits or punctuation. `category` is a canonical engine slug.

create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pattern     text not null check (length(pattern) between 3 and 140),
  category    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, pattern)
);

alter table public.category_rules enable row level security;

drop policy if exists "Users read own category rules" on public.category_rules;
create policy "Users read own category rules"
  on public.category_rules for select using (auth.uid() = user_id);

drop policy if exists "Users insert own category rules" on public.category_rules;
create policy "Users insert own category rules"
  on public.category_rules for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own category rules" on public.category_rules;
create policy "Users update own category rules"
  on public.category_rules for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own category rules" on public.category_rules;
create policy "Users delete own category rules"
  on public.category_rules for delete using (auth.uid() = user_id);
