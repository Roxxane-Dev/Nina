-- 014_chat_pending_actions.sql
-- Pending chat confirmations ("¿Confirmas este gasto?") used to live in API
-- process memory and were lost on restart / not shared across instances.
-- One pending action per user; written only by the backend (service role).

create table if not exists public.chat_pending_actions (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('expense', 'income', 'goal')),
  payload     jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table public.chat_pending_actions enable row level security;

drop policy if exists "Users read own pending actions" on public.chat_pending_actions;
create policy "Users read own pending actions"
  on public.chat_pending_actions for select using (auth.uid() = user_id);
