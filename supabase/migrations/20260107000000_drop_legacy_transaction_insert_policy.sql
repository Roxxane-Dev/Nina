-- Security fix found by supabase/tests/spaces_rls.sql and accounts_rls.sql.
--
-- Production carries a permissive INSERT policy on public.transactions from the
-- old couples model. Permissive policies are OR-ed, so it let a user insert a
-- row with their own user_id into ANY shared_space_id, or with ANOTHER user's
-- account_id, bypassing the checks of "Users insert own transactions"
-- (migrations 20260104 and 20260106). Dropping it leaves the stricter policy
-- as the only INSERT policy. Couple-based inserts (couple_id) stop working;
-- shared spaces replace couples.
drop policy if exists "Users can insert their personal and shared transactions."
  on public.transactions;
