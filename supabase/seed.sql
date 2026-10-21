-- supabase/seed.sql — SYNTHETIC data for the LOCAL database only.
-- Runs automatically on `supabase start` / `supabase db reset` (local Docker).
-- No real names, emails or numbers. Never run this against a hosted project.
--
-- Users (local sign-in with email + password, see auth.users below):
--   A  usuario.a@nina.test   4 months of movements, accounts, consents, member of the shared space
--   B  usuario.b@nina.test   a smaller set (2 months); NOT a member of A's space
--
-- Dates are relative to today's calendar day in Lima (the app's convention, UTC-5), so the data
-- always covers the last 4 calendar months (the current month only up to that day).
-- Values are deterministic.

-- ─── Auth users ──────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'usuario.a@nina.test', extensions.crypt('nina-local-synthetic-1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Usuario A (sintético)"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'usuario.b@nina.test', extensions.crypt('nina-local-synthetic-1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Usuario B (sintético)"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('usuario.a@nina.test', 'usuario.b@nina.test')
on conflict do nothing;

-- ─── Profiles (no trigger on auth.users locally, so they are explicit) ──────
insert into public.profiles (id, email, full_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'usuario.a@nina.test', 'Usuario A (sintético)'),
  ('b0000000-0000-4000-8000-00000000000b', 'usuario.b@nina.test', 'Usuario B (sintético)')
on conflict (id) do nothing;

insert into public.user_profiles (id, full_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'Usuario A (sintético)'),
  ('b0000000-0000-4000-8000-00000000000b', 'Usuario B (sintético)')
on conflict (id) do nothing;

-- ─── System categories ───────────────────────────────────────────────────────
insert into public.categories (name, normalized_name, type, is_system) values
  ('Comida', 'comida', 'expense', true),
  ('Transporte', 'transporte', 'expense', true),
  ('Hogar', 'hogar', 'expense', true),
  ('Servicios', 'servicios', 'expense', true),
  ('Suscripciones', 'suscripciones', 'expense', true),
  ('Entretenimiento', 'entretenimiento', 'expense', true),
  ('Salud', 'salud', 'expense', true),
  ('Sueldo', 'sueldo', 'income', true),
  ('Ingresos extra', 'ingresos extra', 'income', true)
on conflict (normalized_name) do nothing;

-- ─── Accounts ────────────────────────────────────────────────────────────────
insert into public.accounts (id, user_id, name, kind, institution) values
  ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-00000000000a', 'Cuenta sueldo', 'bank', 'Banco de prueba'),
  ('a0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-00000000000a', 'Tarjeta', 'card', 'Banco de prueba'),
  ('a0000000-0000-4000-8000-0000000000c3', 'a0000000-0000-4000-8000-00000000000a', 'Efectivo', 'cash', null),
  ('b0000000-0000-4000-8000-0000000000c1', 'b0000000-0000-4000-8000-00000000000b', 'Cuenta principal', 'bank', 'Banco de prueba')
on conflict (id) do nothing;

-- ─── Consents (so the chat can use the AI path locally) ──────────────────────
insert into public.consents (user_id, purpose, granted, policy_version)
select u, p, true, '2026-10'
from (values ('a0000000-0000-4000-8000-00000000000a'::uuid), ('b0000000-0000-4000-8000-00000000000b'::uuid)) as users(u),
     (values ('data_processing'), ('ai_processing')) as purposes(p);

-- ─── Shared space: only user A is a member ───────────────────────────────────
insert into public.spaces (id, name, type, owner_id) values
  ('a0000000-0000-4000-8000-0000000000f1', 'Casa (sintética)', 'pareja', 'a0000000-0000-4000-8000-00000000000a')
on conflict (id) do nothing;

insert into public.space_members (space_id, user_id, role) values
  ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-00000000000a', 'owner')
on conflict do nothing;

-- ─── Transactions ────────────────────────────────────────────────────────────
-- Template rows: (day of month, type, base amount, category slug, description, account suffix, shared?)
do $seed$
declare
  month_start date;
  d date;
  i int;
  m int;
  amt numeric;
  t record;
  uid_a constant uuid := 'a0000000-0000-4000-8000-00000000000a';
  uid_b constant uuid := 'b0000000-0000-4000-8000-00000000000b';
  space_a constant uuid := 'a0000000-0000-4000-8000-0000000000f1';
  today date := (now() at time zone 'America/Lima')::date;
begin
  -- User A: 4 months (m = 0 is the current month).
  for m in 0..3 loop
    month_start := (date_trunc('month', today) - make_interval(months => m))::date;
    i := 0;
    for t in
      select * from (values
        (1,  'income',  4800.00, 'salary',        'Sueldo',                 'c1', false),
        (3,  'expense', 1200.00, 'home',          'Alquiler',               'c1', true),
        (5,  'expense',  160.00, 'food',          'Supermercado',           'c2', false),
        (9,  'expense',  140.00, 'food',          'Supermercado',           'c2', false),
        (14, 'expense',  150.00, 'food',          'Supermercado',           'c2', false),
        (19, 'expense',  135.00, 'food',          'Supermercado',           'c2', false),
        (24, 'expense',  145.00, 'food',          'Supermercado',           'c2', false),
        (12, 'expense',  180.00, 'food',          'Mercado de la casa',     'c1', true),
        (6,  'expense',   38.00, 'food',          'Delivery',               'c2', false),
        (11, 'expense',   45.00, 'food',          'Delivery',               'c2', false),
        (16, 'expense',   32.00, 'food',          'Delivery',               'c2', false),
        (21, 'expense',   52.00, 'food',          'Delivery',               'c2', false),
        (26, 'expense',   41.00, 'food',          'Delivery',               'c2', false),
        (2,  'expense',   14.00, 'transport',     'Taxi',                   'c3', false),
        (4,  'expense',   18.00, 'transport',     'Taxi',                   'c3', false),
        (7,  'expense',   12.00, 'transport',     'Pasaje',                 'c3', false),
        (10, 'expense',   22.00, 'transport',     'Taxi',                   'c3', false),
        (13, 'expense',   15.00, 'transport',     'Taxi',                   'c3', false),
        (17, 'expense',   25.00, 'transport',     'Taxi',                   'c3', false),
        (20, 'expense',   12.00, 'transport',     'Pasaje',                 'c3', false),
        (23, 'expense',   19.00, 'transport',     'Taxi',                   'c3', false),
        (27, 'expense',   16.00, 'transport',     'Taxi',                   'c3', false),
        (8,  'expense',   44.90, 'subscriptions', 'Netflix',                'c2', false),
        (10, 'expense',   24.90, 'subscriptions', 'Spotify',                'c2', false),
        (12, 'expense',   89.00, 'subscriptions', 'Gimnasio',               'c2', false),
        (15, 'expense',   95.00, 'services',      'Luz',                    'c1', false),
        (16, 'expense',   42.00, 'services',      'Agua',                   'c1', false),
        (18, 'expense',   79.90, 'services',      'Internet',               'c1', false),
        (22, 'expense',   60.00, 'entertainment', 'Cine',                   'c2', false)
      ) as v(day, kind, base, cat, descr, acct, shared)
    loop
      i := i + 1;
      d := month_start + (t.day - 1);
      continue when d > today;
      -- Recurring bills keep their exact amount; the rest varies a little, deterministically.
      amt := case when t.cat in ('subscriptions', 'services') or t.descr in ('Sueldo', 'Alquiler')
                  then t.base
                  else round(t.base * (1 + (((m * 3 + i) % 7) - 3) * 0.015), 2) end;
      insert into public.transactions (user_id, amount, category, description, date, type, source, account_id, shared_space_id)
      values (uid_a, amt, t.cat, t.descr, (d::timestamp at time zone 'UTC'), t.kind::public.transaction_type, 'manual',
              ('a0000000-0000-4000-8000-0000000000' || t.acct)::uuid,
              case when t.shared then space_a else null end);
    end loop;

    -- One extra freelance income in the previous month only.
    if m = 1 then
      insert into public.transactions (user_id, amount, category, description, date, type, source, account_id)
      values (uid_a, 600.00, 'freelance', 'Trabajo extra', ((month_start + 19)::timestamp at time zone 'UTC'),
              'income', 'manual', 'a0000000-0000-4000-8000-0000000000c1');
    end if;
  end loop;

  -- User B: a smaller set, 2 months.
  for m in 0..1 loop
    month_start := (date_trunc('month', today) - make_interval(months => m))::date;
    i := 0;
    for t in
      select * from (values
        (1,  'income',  2500.00, 'salary',    'Sueldo',        'c1'),
        (4,  'expense',  700.00, 'home',      'Alquiler',      'c1'),
        (8,  'expense',   95.00, 'food',      'Supermercado',  'c1'),
        (15, 'expense',   88.00, 'food',      'Supermercado',  'c1'),
        (22, 'expense',   30.00, 'food',      'Delivery',      'c1'),
        (6,  'expense',   10.00, 'transport', 'Pasaje',        'c1'),
        (13, 'expense',   10.00, 'transport', 'Pasaje',        'c1'),
        (20, 'expense',   16.00, 'transport', 'Taxi',          'c1')
      ) as v(day, kind, base, cat, descr, acct)
    loop
      i := i + 1;
      d := month_start + (t.day - 1);
      continue when d > today;
      insert into public.transactions (user_id, amount, category, description, date, type, source, account_id)
      values (uid_b, t.base, t.cat, t.descr, (d::timestamp at time zone 'UTC'), t.kind::public.transaction_type, 'manual',
              'b0000000-0000-4000-8000-0000000000c1');
    end loop;
  end loop;
end
$seed$;
