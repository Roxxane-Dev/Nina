-- Goal contributions (HOME-02, decision D-015).
-- Part of the active chain for local databases. NOT applied to production: the founder runs it
-- by hand through docs/PROD-MIGRATION-RUNBOOK.md.
--
-- "Aparté S/ 200 para Japón" is a movement in public.transactions linked to the goal with
-- goal_id (category 'savings', type 'expense'). transactions stays the single source of truth:
-- the engine reads goal-linked rows as money set aside (not spending), subtracts it from the
-- month's available figure and adds it to the goal's progress. Nina never moves money; this only
-- records what the user did.

alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index if not exists transactions_goal_id_idx on public.transactions (goal_id) where goal_id is not null;

-- A contribution is a personal outflow: never in a shared space, never an income.
alter table public.transactions drop constraint if exists transactions_goal_contribution_shape;
alter table public.transactions add constraint transactions_goal_contribution_shape
  check (goal_id is null or (type = 'expense' and shared_space_id is null));

-- RLS: a movement can only be linked to one of the author's own goals.
-- Same policies as 20260108 plus the goal_id check.
drop policy if exists "Users insert own transactions" on public.transactions;
create policy "Users insert own transactions"
  on public.transactions for insert
  with check (
    auth.uid() = user_id
    and (shared_space_id is null or public.is_space_member(shared_space_id))
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
    ))
    and (couple_id is null or exists (
      select 1 from public.couples c
      where c.id = couple_id and (c.user_1_id = auth.uid() or c.user_2_id = auth.uid())
    ))
    and (goal_id is null or exists (
      select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()
    ))
  );

drop policy if exists "Users update own transactions" on public.transactions;
create policy "Users update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (shared_space_id is null or public.is_space_member(shared_space_id))
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
    ))
    and (couple_id is null or exists (
      select 1 from public.couples c
      where c.id = couple_id and (c.user_1_id = auth.uid() or c.user_2_id = auth.uid())
    ))
    and (goal_id is null or exists (
      select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()
    ))
  );
