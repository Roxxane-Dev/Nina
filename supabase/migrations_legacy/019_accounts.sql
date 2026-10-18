-- 019_accounts.sql
-- US-41: the user's accounts (bank, cash, card, wallet) to organize where each
-- movement comes from. No balances here (the bank-balance anchor is Phase 2).
-- Requires 017 (the transaction policies below also check space membership).

create table if not exists public.accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 40),
  kind         text not null check (kind in ('bank', 'cash', 'card', 'wallet')),
  institution  text check (institution is null or length(institution) <= 40),
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id);

alter table public.accounts enable row level security;

drop policy if exists "Users read own accounts" on public.accounts;
create policy "Users read own accounts"
  on public.accounts for select using (auth.uid() = user_id);

drop policy if exists "Users insert own accounts" on public.accounts;
create policy "Users insert own accounts"
  on public.accounts for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own accounts" on public.accounts;
create policy "Users update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No delete policy: accounts are archived, so past movements keep their account.

alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
create index if not exists transactions_account_idx
  on public.transactions (account_id) where account_id is not null;

-- A movement can only point to one of its author's own accounts (and, from
-- 017, only to a space its author belongs to).
drop policy if exists "Users insert own transactions" on public.transactions;
create policy "Users insert own transactions"
  on public.transactions for insert
  with check (
    auth.uid() = user_id
    and (shared_space_id is null or public.is_space_member(shared_space_id))
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
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
  );
