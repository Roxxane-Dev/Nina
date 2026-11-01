-- Goal withdrawals (HOME-04, decision D-017).
-- Part of the active chain for local databases. NOT applied to production: see section 9 of
-- docs/PROD-MIGRATION-RUNBOOK.md, it goes right after 20261027000000.
--
-- A withdrawal is a movement linked to the goal with type 'income' (category 'savings'): money that
-- goes back to the month's available figure. The engine never counts it as income. Contributions stay
-- type 'expense'. The only rule left in the check is that a goal movement is never in a shared space.

alter table public.transactions drop constraint if exists transactions_goal_contribution_shape;
alter table public.transactions add constraint transactions_goal_contribution_shape
  check (goal_id is null or shared_space_id is null);
