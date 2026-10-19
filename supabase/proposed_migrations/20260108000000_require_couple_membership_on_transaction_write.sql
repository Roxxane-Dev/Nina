-- PROPOSED follow-up, NOT in the active chain and NOT applied anywhere.
-- Lives in supabase/proposed_migrations/ so `supabase db reset` does not run it.
-- Copy it to supabase/migrations/ (keeping the timestamp) only after the founder decides.
-- It is included as the last, optional step of docs/PROD-MIGRATION-RUNBOOK.md.
--
-- Why: after 20260107 the only INSERT policy on public.transactions is
-- "Users insert own transactions", which checks user_id, space membership and
-- account ownership but not couple_id. A user session could therefore write a row
-- with their own user_id and ANOTHER couple's id; that couple's members would see
-- it through the SELECT policy "Users can view their personal and shared
-- transactions.". This adds the missing check: couple_id must be null or belong to a
-- couple the author is part of. It also covers UPDATE, so a row cannot be moved into
-- someone else's couple.
--
-- Side effect: legitimate couple members can insert rows with their own couple_id
-- again (the legacy policy dropped in 20260107 used to allow that).

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
  );
