-- 018_consents.sql
-- US-03 / US-42 (FR-02): explicit, granular, revocable consent, logged.
-- Append-only: every change is a new row; the current state of a purpose is
-- its latest row. Rows are never updated or deleted by clients.

create table if not exists public.consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  purpose         text not null check (purpose in ('data_processing', 'ai_processing', 'analytics')),
  granted         boolean not null,
  policy_version  text not null,
  created_at      timestamptz not null default now()
);

create index if not exists consents_user_purpose_idx
  on public.consents (user_id, purpose, created_at desc);

alter table public.consents enable row level security;

drop policy if exists "Users read own consents" on public.consents;
create policy "Users read own consents"
  on public.consents for select using (auth.uid() = user_id);

drop policy if exists "Users record own consents" on public.consents;
create policy "Users record own consents"
  on public.consents for insert with check (auth.uid() = user_id);
