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
