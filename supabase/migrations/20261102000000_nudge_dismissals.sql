-- Avisos de Nina (NOTIF-01, decision D-018).
-- Part of the active chain for local databases. NOT applied to production: see section 9 of
-- docs/PROD-MIGRATION-RUNBOOK.md.
--
-- Nudges are computed by the engine on read and never stored. This table only remembers which ones
-- the user closed, by the nudge's per-period key, so they do not come back until the next period.

create table if not exists public.nudge_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  nudge_key text not null check (char_length(nudge_key) between 1 and 120),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, nudge_key)
);

alter table public.nudge_dismissals enable row level security;

drop policy if exists "Users read own nudge dismissals" on public.nudge_dismissals;
create policy "Users read own nudge dismissals"
  on public.nudge_dismissals for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own nudge dismissals" on public.nudge_dismissals;
create policy "Users insert own nudge dismissals"
  on public.nudge_dismissals for insert
  with check (auth.uid() = user_id);
