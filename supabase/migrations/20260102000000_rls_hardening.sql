-- 013_rls_hardening.sql
-- Closes row-level-security gaps found in the 2026-10 audit.
-- The Flutter app talks to Supabase directly with the anon key, so any
-- user-owned table without RLS is readable by every signed-in user.
-- The NestJS API uses the service role and is not affected by these policies.

-- ─── messages (chat history + embeddings) ────────────────────────────────────
-- Written only by the backend. Users may read and delete their own history.
alter table public.messages enable row level security;

drop policy if exists "Users read own messages" on public.messages;
create policy "Users read own messages"
  on public.messages for select using (auth.uid() = user_id);

drop policy if exists "Users delete own messages" on public.messages;
create policy "Users delete own messages"
  on public.messages for delete using (auth.uid() = user_id);

-- ─── categories (system catalogue) ───────────────────────────────────────────
-- Readable by signed-in users; writable only by the service role.
alter table public.categories enable row level security;

drop policy if exists "Authenticated read categories" on public.categories;
create policy "Authenticated read categories"
  on public.categories for select to authenticated using (true);

-- ─── transactions: missing update/delete policies ────────────────────────────
drop policy if exists "Users update own transactions" on public.transactions;
create policy "Users update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own transactions" on public.transactions;
create policy "Users delete own transactions"
  on public.transactions for delete using (auth.uid() = user_id);

-- ─── Tables created outside migrations (dashboard) ───────────────────────────
-- subscriptions and ai_insights are altered by 010 but never created in a
-- migration. If they exist, enforce owner-only access.
do $$
declare
  t text;
begin
  foreach t in array array['subscriptions', 'ai_insights'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'user_id'
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "Users read own %s" on public.%I', t, t);
      execute format(
        'create policy "Users read own %s" on public.%I for select using (auth.uid() = user_id)',
        t, t
      );
    end if;
  end loop;
end;
$$;
