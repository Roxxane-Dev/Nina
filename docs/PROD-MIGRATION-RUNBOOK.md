# Production migration runbook

Status: **draft for the founder. Nothing in this document has been executed against production.** I (Claude) never connect to production; you run these steps yourself in the Supabase SQL Editor of the production project, after reading them.

Scope: migrations `20260102` to `20260107` in `supabase/migrations/`, plus the couple_id check `20260108` (step 7) and the system categories `20260109` (step 8), also in `supabase/migrations/`.

- **Do not run** `20260101000000_baseline_prod_snapshot.sql`: it only mirrors what production already has (it is for fresh local databases).
- **Never include seed data.** `supabase/seed.sql` is for the local database only. Never run `supabase db push` (with or without `--include-seed`) against any remote; this runbook uses the SQL Editor only.

Tested on: a fresh local Postgres 17 built from the production snapshot (`docs/schema-prod-snapshot.sql`), by replaying exactly the SQL block of section 4 (see section 8). Not tested on a copy of production data.

## 0. Before you start
> Founder decision (D-018): the production project is on the Free plan, which has no backups. It is an MVP with a single user, so the migration runs without one. Add backups before there are real users.
- **Backup first (skipped, see above).** Dashboard → Database → Backups: confirm a recent backup exists (or note the PITR timestamp). If you are on a plan without PITR, take a manual backup. Write down the time.
- Open the SQL Editor on the **production** project and double-check the project name in the top bar.
- Use one SQL Editor tab per script below; do not mix them.
- Run section 2 (read-only) first and stop if a gate in section 3 fails.

## 1. Migrations, in order

| # | File | What it does | What could break |
|---|---|---|---|
| 1 | `20260102000000_rls_hardening.sql` | Re-states RLS and policies that production already has by the same names: messages (read/delete own), categories (authenticated read), transactions (update/delete own), and "read own" on `subscriptions` and `ai_insights` when they have `user_id`. Drops and recreates each policy. | Practically nothing: same names and conditions as production. Inside one transaction the drop/create is atomic, so there is no window without a policy. |
| 2 | `20260103000000_category_rules.sql` | New table `category_rules` (per-user "remember this category") with RLS. | Nothing existing depends on it. The app's correction feature starts working. |
| 3 | `20260104000000_shared_spaces.sql` | New tables `spaces`, `space_members`, `space_invites`; new column `transactions.shared_space_id`; helper `is_space_member()` (security definer); new policies "Members read shared transactions" and "Users insert/update own transactions". | **Security window:** after this step, and until step 6, production's old permissive INSERT policy lets a user insert into any space. Run steps 1-8 in one transaction. Adding a nullable column is quick but takes a short lock on `transactions`. |
| 4 | `20260105000000_consents.sql` | New append-only table `consents` with RLS. | The app starts requiring consent before using AI. Users with no consent row see the consent screen once. |
| 5 | `20260106000000_accounts.sql` | New table `accounts`; new column `transactions.account_id`; replaces the insert/update policies on `transactions` so a movement can only point to the author's own account and to a space the author belongs to. | Same lock note as step 3. Clients that insert with an `account_id` that is not theirs are now rejected (by design). |
| 6 | `20260107000000_drop_legacy_transaction_insert_policy.sql` | Drops the policy "Users can insert their personal and shared transactions." on `transactions`. | **Couple-based inserts from a user session stop working** (the service role is unaffected). Reading couple rows keeps working. Step 7 restores them safely. |
| 7 | `20260108000000_require_couple_membership_on_transaction_write.sql` | Replaces the INSERT and UPDATE policies on `transactions` so `couple_id` must be null or belong to a couple the author is part of. | Couple members can insert couple rows from their own session again; non-members cannot. Tested locally with `supabase/tests/couple_insert_rls.sql` (6 of 6 pass; the same test fails without the migration). If you decide couples are retired, skip step 7 and remove its block and the verification check "1b". |
| 8 | `20260109000000_system_categories.sql` | Inserts the 13 system categories (food, transport, home, services, health, education, entertainment, shopping, subscriptions, debt, salary, freelance, other) into `public.categories` with `on conflict do nothing`. | Nothing existing: the production table is empty (checked: 0 rows). Without these rows, registering any movement from the chat fails with "Category ... not found and no fallback" (found when testing the app). Query 2.9 below shows the current rows. |

Why step 6 exists: policies of the same command are OR-ed. With the old policy still there, a user could insert `shared_space_id = <someone else's space>` or `account_id = <someone else's account>` as long as `user_id` was theirs, bypassing the checks from steps 3 and 5. The local RLS tests (`spaces_rls.sql`, `accounts_rls.sql`) failed until the policy was dropped and pass after.

Why step 7 exists: after step 6 nothing validates `couple_id` on insert. A user session could write a row with their own `user_id` and another couple's id, and that couple would see it. Guessing a couple's UUID is impractical, but the check is cheap.

## 2. Read-only queries (run in the production SQL Editor)

All of these only `select`. They return counts and policy text, not user content.

### 2.1 Is `couples` still in use?
```sql
select
  (select count(*) from public.couples)                              as couples_total,
  (select count(*) from public.couples where user_2_id is not null)  as couples_with_two_members,
  (select count(*) from public.profiles where current_couple_id is not null) as profiles_in_a_couple;
```

### 2.2 Transactions that depend on `couple_id` (the policy being replaced)
```sql
select
  count(*) filter (where couple_id is not null)                                         as rows_with_couple_id,
  count(*) filter (where couple_id is not null and created_at > now() - interval '30 days') as couple_rows_last_30d,
  count(*) filter (where couple_id is not null and created_at > now() - interval '7 days')  as couple_rows_last_7d,
  max(created_at) filter (where couple_id is not null)                                   as last_couple_row_at
from public.transactions;
```

### 2.3 Daily couple rows, last 30 days
Rows written by the backend (service role) are not affected by step 6. If the numbers are zero, nothing depends on the policy.
```sql
select date_trunc('day', created_at)::date as day, count(*) as couple_rows
from public.transactions
where couple_id is not null and created_at > now() - interval '30 days'
group by 1
order by 1 desc;
```

### 2.4 Current policies on `transactions`
```sql
select policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'transactions'
order by cmd, policyname;
```
Expected before: the policy "Users can insert their personal and shared transactions." (INSERT) and "Users can view their personal and shared transactions." (SELECT) are present.

### 2.5 Policies on the other tables the migrations touch
```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('messages','categories','subscriptions','ai_insights')
order by tablename, cmd, policyname;
```

### 2.6 State of the tables and columns the migrations create
```sql
select
  to_regclass('public.spaces')         as spaces,
  to_regclass('public.space_members')  as space_members,
  to_regclass('public.space_invites')  as space_invites,
  to_regclass('public.category_rules') as category_rules,
  to_regclass('public.consents')       as consents,
  to_regclass('public.accounts')       as accounts;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'transactions'
order by ordinal_position;

select p.proname, p.prosecdef
from pg_proc p join pg_namespace s on s.oid = p.pronamespace
where s.nspname = 'public' and p.proname = 'is_space_member';
```
Expected before: every `to_regclass` is null; `transactions` has no `shared_space_id` or `account_id`; no `is_space_member`. If any already exists, stop: production is not in the state this runbook assumes.

### 2.7 RLS status and approximate size of every table
```sql
select c.relname, c.relrowsecurity as rls_on, c.reltuples::bigint as approx_rows
from pg_class c join pg_namespace s on s.oid = c.relnamespace
where s.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

### 2.8 Triggers on `auth.users` (not in the schema snapshot)
```sql
select tgname, tgenabled, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```
Unrelated to these migrations; the snapshot could not show whether `handle_new_user` / `create_user_profile` are attached. Note the result for later.

### 2.9 System categories already present?
```sql
select normalized_name, name, is_system from public.categories order by normalized_name;
```
Expected before: no rows (or only some of the 13). Step 8 is idempotent either way.

## 3. Decision gates
- **2.2 / 2.3 show recent couple rows (last 30 days > 0):** something still writes couple rows. Check whether it uses the service role (fine) or a user session. With step 7 included, legitimate couple members keep working, so this is a warning, not a stop. If you skip step 7, stop here until you know.
- **2.1 shows couples in use:** keep step 7. If couples are retired, you may skip it.
- **2.6 shows any target object already existing:** stop and compare with the migration files.
- **2.4 does not list the legacy INSERT policy:** step 6 is a no-op (`drop policy if exists`); fine.
- All clear: continue.

## 4. The script (all eight steps, one transaction, verification, default ROLLBACK)

How to use it:
1. Paste the whole block into a **new** SQL Editor tab on production.
2. First run it as is. It ends with `rollback`, so it is a dry run: if it finishes without an error and prints "All verifications passed", the migrations apply cleanly on your data.
3. Then change the very last line from `rollback;` to `commit;` and run it again to apply for real.
4. If any statement fails, the transaction is aborted. If the editor leaves the session in an aborted state, run `rollback;` by itself.

```sql
begin;
set local lock_timeout = '5s';        -- fail fast instead of queueing behind long transactions
set local statement_timeout = '60s';

-- ════════ 20260102000000_rls_hardening.sql ════════
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

-- ════════ 20260103000000_category_rules.sql ════════
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

-- ════════ 20260104000000_shared_spaces.sql ════════
-- 017_shared_spaces.sql
-- US-33 to US-39: shared spaces (couple / family) with a common fund,
-- separated from each member's personal finances.
--
-- Model
--   spaces          a shared space ("Casa")
--   space_members   who belongs to it (membership lives in a table, not JSON)
--   space_invites   8-char join codes, valid 7 days (API only)
--   transactions.shared_space_id   null = personal; set = belongs to that space
--
-- Privacy (US-39): a member sees the space's rows, never another member's
-- personal rows (those keep shared_space_id = null and stay owner-only).
-- The legacy columns transactions.space_id (text) and couple_id are not used
-- by this model and are left untouched.

-- ─── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 40),
  type        text not null default 'pareja' check (type in ('pareja', 'familia', 'otro')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index if not exists space_members_user_idx on public.space_members (user_id);

create table if not exists public.space_invites (
  code        text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table public.transactions
  add column if not exists shared_space_id uuid references public.spaces(id) on delete set null;
create index if not exists transactions_shared_space_idx
  on public.transactions (shared_space_id) where shared_space_id is not null;

-- ─── Membership helper ───────────────────────────────────────────────────────
-- security definer so policies on space_members can use it without recursion.
create or replace function public.is_space_member(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_space_member(uuid) from public;
grant execute on function public.is_space_member(uuid) to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Spaces, memberships and invites are written only by the API (service role);
-- clients may read the spaces they belong to and their members.
alter table public.spaces enable row level security;
drop policy if exists "Members read their spaces" on public.spaces;
create policy "Members read their spaces"
  on public.spaces for select using (public.is_space_member(id));

alter table public.space_members enable row level security;
drop policy if exists "Members read space members" on public.space_members;
create policy "Members read space members"
  on public.space_members for select using (public.is_space_member(space_id));

alter table public.space_invites enable row level security; -- no policies: API only

-- Transactions: members read the space's rows (added to the owner-only policy).
drop policy if exists "Members read shared transactions" on public.transactions;
create policy "Members read shared transactions"
  on public.transactions for select
  using (shared_space_id is not null and public.is_space_member(shared_space_id));

-- A row can only be attached to a space its author belongs to; otherwise any
-- user could inject movements into someone else's space.
drop policy if exists "Users insert own transactions" on public.transactions;
create policy "Users insert own transactions"
  on public.transactions for insert
  with check (
    auth.uid() = user_id
    and (shared_space_id is null or public.is_space_member(shared_space_id))
  );

drop policy if exists "Users update own transactions" on public.transactions;
create policy "Users update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (shared_space_id is null or public.is_space_member(shared_space_id))
  );

-- ════════ 20260105000000_consents.sql ════════
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

-- ════════ 20260106000000_accounts.sql ════════
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

-- ════════ 20260107000000_drop_legacy_transaction_insert_policy.sql ════════
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

-- ════════ 20260108000000_require_couple_membership_on_transaction_write.sql ════════
-- Couple membership check on transactions (step 7 of docs/PROD-MIGRATION-RUNBOOK.md).
-- Part of the active chain for local databases. NOT applied to production: the founder runs it
-- by hand through the runbook, after reading its decision gates.
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

-- ════════ 20260109000000_system_categories.sql ════════
-- System categories: reference data the backend requires.
--
-- ExpensesService.resolveCategory looks up public.categories (is_system = true) by the engine's
-- canonical slug and falls back to 'other'. With no rows there, registering any movement through
-- the chat fails ('Category "transport" not found and no fallback'). The production snapshot has
-- zero rows in this table, so the data has to travel with the migrations.
--
-- Slugs and labels mirror packages/finance-engine/src/categories.ts (CATEGORY_LABELS_ES).
-- Idempotent: safe to run on a database that already has some of them.

insert into public.categories (name, normalized_name, type, is_system) values
  ('Comida',          'food',          'expense', true),
  ('Transporte',      'transport',     'expense', true),
  ('Hogar',           'home',          'expense', true),
  ('Servicios',       'services',      'expense', true),
  ('Salud',           'health',        'expense', true),
  ('Educación',       'education',     'expense', true),
  ('Entretenimiento', 'entertainment', 'expense', true),
  ('Compras',         'shopping',      'expense', true),
  ('Suscripciones',   'subscriptions', 'expense', true),
  ('Deudas',          'debt',          'expense', true),
  ('Sueldo',          'salary',        'income',  true),
  ('Ingresos extra',  'freelance',     'income',  true),
  ('Otros',           'other',         'expense', true)
on conflict (normalized_name) do nothing;

-- ─── Verification: any failure raises and aborts the whole transaction ───────────
do $verify$
declare
  t text;
  n int;
begin
  -- 1) The legacy permissive INSERT policy is gone and only the strict one remains.
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions'
             and policyname = 'Users can insert their personal and shared transactions.') then
    raise exception 'VERIFY FAILED: legacy INSERT policy still present';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'transactions' and cmd = 'INSERT';
  if n <> 1 then
    raise exception 'VERIFY FAILED: expected exactly 1 INSERT policy on transactions, found %', n;
  end if;

  -- 1b) The surviving INSERT policy checks couple membership (step 7).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions'
                 and cmd = 'INSERT' and with_check like '%couples%') then
    raise exception 'VERIFY FAILED: INSERT policy does not check couple membership';
  end if;

  -- 1c) Reference data: every canonical system category exists (the chat cannot register movements without them).
  select count(*) into n from public.categories where is_system and normalized_name in
    ('food','transport','home','services','health','education','entertainment','shopping','subscriptions','debt','salary','freelance','other');
  if n <> 13 then raise exception 'VERIFY FAILED: expected 13 system categories, found %', n; end if;

  -- 2) New tables exist and have RLS on.
  foreach t in array array['spaces','space_members','space_invites','category_rules','consents','accounts'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'VERIFY FAILED: table public.% missing', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'VERIFY FAILED: RLS is off on public.%', t;
    end if;
  end loop;

  -- 3) New columns on transactions.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'transactions' and column_name in ('shared_space_id','account_id');
  if n <> 2 then raise exception 'VERIFY FAILED: transactions is missing shared_space_id/account_id'; end if;

  -- 4) Membership helper exists and is security definer.
  if not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                 where s.nspname = 'public' and p.proname = 'is_space_member' and p.prosecdef) then
    raise exception 'VERIFY FAILED: is_space_member missing or not security definer';
  end if;

  -- 5) No table in public is left without RLS.
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if n <> 0 then raise exception 'VERIFY FAILED: % table(s) in public without RLS', n; end if;

  -- 6) Policies the app relies on are still there.
  foreach t in array array['Users insert own transactions','Users update own transactions',
                           'Users delete own transactions','Members read shared transactions',
                           'Users can view their personal and shared transactions.'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = t) then
      raise exception 'VERIFY FAILED: policy "%" missing on transactions', t;
    end if;
  end loop;

  raise notice 'All verifications passed.';
end
$verify$;

rollback;   -- ← change to: commit;   (only after the dry run printed "All verifications passed")
```

## 5. After committing (read-only checks)
Re-run 2.4 and 2.7. Expected: exactly one INSERT policy on `transactions` ("Users insert own transactions", which now mentions `couples`); every table in `public` has `rls_on = true`. Then in the app: add a movement, add a movement to a space, create an account. The RLS test files in `supabase/tests/` are for a **local** database only; do not run them on production.

## 6. Rollback
- **Before `commit`:** nothing to undo (the transaction rolls back).
- **After `commit`, the app misbehaves:** steps 1-5 are additive (new tables, nullable columns, new policies), so the safe move is to leave them and fix forward. Steps 6 and 7 change insert behaviour on `transactions`:
  - To undo step 7 only (go back to the policies from step 5/6): re-run the `20260106` block's `Users insert own transactions` and `Users update own transactions` policies (the two `create policy` statements in that file, after their `drop policy if exists`).
  - To restore the old behaviour for couple inserts, accept that this reopens the hole in step 6's explanation, and run:
```sql
create policy "Users can insert their personal and shared transactions."
  on public.transactions for insert
  with check (
    (user_id = auth.uid() and couple_id is null)
    or couple_id in (select id from public.couples where user_1_id = auth.uid() or user_2_id = auth.uid())
  );
```
  (This is the definition from the production snapshot.) Drop it again once whatever depends on it is fixed.
- **Full revert (last resort, destroys data in the new tables):** restore the backup/PITR point from section 0. Do not hand-drop the new tables if users have already created spaces, accounts or consents.

## 7. Residual risks to know about
- Other oddities in the production schema (global unique `categories.normalized_name`, the subscriptions policy comparing `owner_id` with `couples.id`, `transactions.space_id text default 'personal'`) are unchanged by these migrations.
- The migrations were tested on a fresh database, not on production data volume. The dry run in section 4 is how you check your real data.
- Locks: `alter table ... add column` takes a brief lock on `transactions`. The script sets `lock_timeout = 5s`, so it fails fast instead of blocking the app; if that happens, retry at a quieter time.

## 8. Replay result (local)
Section 4's SQL, extracted from this file with the last line changed to `commit;`, was applied to a fresh local database containing only the production snapshot baseline (`supabase db reset --version 20260101000000 --no-seed`, local Docker). Results are recorded in `docs/OVERNIGHT-LOG.md` (task 7).

## 9. Later migrations: goals and nudges (`20261027000000`, `20261101000000`, `20261102000000`)
Not part of the section 4 transaction. Apply them, in that order, after sections 1–8, as one script in the SQL Editor.

`20261102000000` (NOTIF-01) adds the table `nudge_dismissals` with RLS, and the API reads it. Apply it in the same script, after the other two.

`20261101000000` (HOME-04) only relaxes the CHECK below to `goal_id is null or shared_space_id is null`, so a withdrawal (a goal row with `type = 'income'`) is allowed. It takes a brief lock on `transactions` and changes no data.

- **Order matters:** the API that ships with HOME-02 reads `transactions.goal_id`. Apply this migration **before** deploying that API; otherwise every engine read (Inicio, chat, Metas) fails with a missing-column error.
- **What it does:**
  - Adds nullable `transactions.goal_id` referencing `goals(id) on delete set null`, plus a partial index.
  - Adds the CHECK `transactions_goal_contribution_shape`: a goal-linked row must be `type = 'expense'` with no `shared_space_id`.
  - Recreates "Users insert own transactions" and "Users update own transactions" with the same conditions as `20260108`, plus "the goal belongs to the author".
- **What could break:**
  - Brief lock on `transactions` while adding the column; use `set lock_timeout = '5s';` first.
  - The CHECK validates existing rows, but they all have `goal_id = null`, so it passes.
- **Test:** locally, `supabase/tests/goal_contributions_rls.sql` (5 of 5). Do not run it on production.
- **Rollback:** fix forward if possible. Otherwise run `alter table public.transactions drop constraint transactions_goal_contribution_shape;`, re-run the two policies from `20260108`, then drop the column. Dropping the column loses which movements were contributions; the movements themselves stay.
