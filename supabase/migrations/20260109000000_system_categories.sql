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
