# Nina — project instructions

Nina is an AI financial-intelligence layer (not a neobank, not a wallet) for users in Peru (es-PE, PEN/USD). Solo, part-time founder in Lima.
Stack: Flutter app (`nina_app/`), NestJS API (`src/`, "Nina OS"), pure engine package (`packages/finance-engine/`), Supabase (Postgres + Auth + Storage), migrations in `supabase/migrations/`.
Blueprint docs (target design, not current state): NINA-PRD-001, NINA-FDS-001, NINA-SAD-001, NINA-TS-001. Ask the user for them when needed.

## Product thesis and phases
Hypothesis that guides every decision: people want an AI that knows their financial situation and tells them what to do with their money.
If a task does not help test this, do not build it. Ask before starting anything outside the current scope.
1. **Nina Intelligence** (now): understand → predict → recommend. Never moves money.
2. Nina Agent (later): executes actions with explicit authorization via a licensed BaaS partner.
3. Nina Wallet (later): payments, savings, credit.
Differentiators: forecast, explainable score, what-if simulator — not plain categorization (FinovAI, Finno, Finsight already do that).
Benchmarks: **Cleo** for voice and tone, **Revolut AIR** for chat UX. Positioning: Intelligence now, never moves money (for now); Agent and Wallet phases stay open.

## Segment (open decision)
Building **Nina Personal (B2C)**: urban professional, 23–35, Lima, formal salary, 2+ financial products.
Nina Negocio (mypes via independent accountants) is an open alternative. Do not build mype/SUNAT features until the user decides after validating the personal MVP.

## Current scope — lean MVP, due 2026-10-31
IN: auth, manual transaction entry (CSV import only as stretch), categorization, minimal engine (per-category aggregates + one "available this month" figure), Home dashboard, grounded chat with a basic number validator, **shared spaces** (couple/family).
OUT this month (return in November): full forecast, explainable health score, what-if, PDF statement import, notifications, export/deletion, Nina Negocio.
Always OUT (keep behind feature flags, do not extend): household *intelligence*, emotion/streak/relapse/behavioral features, extra proactive triggers, new LLM providers, anything that moves money.

### State as of 2026-10-18
- **Built:** Home "Cómo calculé esto" audit sheet (PRD-AUD-06: the engine returns an `audit` block on `GET /v1/overview` with formula, period, income/expenses, `txnCount` and evidence ids; the app only renders it). Nina voice block in `CHAT_SYSTEM_PROMPT_V1`. **Calm mode** (debt, income loss, distress): a deterministic keyword rule in `src/chat/calm-mode.ts`; data questions are answered from the engine template without the LLM, everything else gets a fixed humorless reply. Never detect it with an LLM.
- **Retired:** `NinaFinanceEngine` (`src/intelligence/*` except `state-machine`), `/intelligence/snapshot`, `/home/intelligence` and the nightly snapshot job, Dart-side metric code and the mocked home/insights screens. The behavioral flags `premium_behavior_dashboard` and `predictive_risk_timeline` were deleted. Emotion, prevention, streak and proactive services still exist in `src/ai` but have no entry point (no controller, cron or event); do not wire them. The `financial_streaks` table stays in the schema.
- **Privacy:** PII is redacted (`src/nina-router/redaction.ts`: email, phone incl. +51, DNI, RUC, CCI, cards) before any text goes to an LLM or to OpenAI embeddings. WebSocket CORS uses the env allowlist `CORS_ALLOWED_ORIGINS` (empty = no browser origin).
- **Database:** `supabase/migrations` is now a baseline of the production `public` schema plus re-based migrations; the old chain is archived, unchanged, in `supabase/migrations_legacy`. Develop against local Supabase (`npx supabase@latest start` / `db reset`). Never run `link`, `push`, `pull` or `dump --linked`; production migrations are applied by the founder after review.

### Pending review (branches pushed, not merged)
- `feature/calm-mode-final`: distress reply with the crisis line (single constant `DISTRESS_HELPLINE` in `src/chat/calm-mode.ts`, also used by the system prompt); distress overrides data questions. Do not hard-code the number anywhere else.
- `fix/log-hygiene`: logs carry error codes and counts only (`src/common/log-safe.ts`); never log message text, amounts, descriptions or raw provider errors.
- `chore/remove-unwired-behavioral`: removes the unwired behavioral, emotion, prevention, proactive, profiles and social code in `src/ai`. Do not rebuild it without a founder decision.
- `chore/prod-runbook`: `docs/PROD-MIGRATION-RUNBOOK.md` for the production migrations (the founder applies them by hand); `supabase/proposed_migrations/` holds the unapplied couple_id check.
- `chore/local-seed-verify`: `supabase/seed.sql` (synthetic, local only) and `npm test` with `--maxWorkers=2`.

### Shared spaces (new requirement)
Several users see and categorize expenses of a common fund (rent, groceries, utilities), separate from each member's 100% private finances.
- Membership lives in a table (`space_members`), not in a JSON column. RLS on shared rows checks membership (`exists (select 1 from space_members where space_id = … and user_id = auth.uid())`), via a `security definer` helper to avoid recursive policies.
- A personal transaction is never visible to other members. Only rows explicitly assigned to a space are shared.
- Propose the data model and get approval before implementing.

## Architecture rules (never violate)
- **One engine, the LLM never computes numbers.** All financial numbers come from ONE deterministic engine (`packages/finance-engine`, used through `FinanceEngineService`). The LLM only explains; it never computes or invents figures, and the number validator stays fail-closed (falls back to the engine template).
- Do not create a second place that computes the same metric. If two services compute it, consolidate into the engine.
- `transactions` is the single source of truth. Derived data must be reproducible from it.
- The Flutter client queries Supabase directly, so every user-owned table MUST have RLS (`user_id = auth.uid()`, or space membership for shared rows). Never rely on client code for isolation.
- The backend uses the service-role client. Always derive `userId` from the validated JWT (`SupabaseAuthGuard`); never trust a client-supplied user id. Every controller and WebSocket gateway must be guarded.
- Never send raw transactions or balances to an LLM. Send engine-computed facts (`FactsPayload`); redact PII; treat transaction descriptions as untrusted text (prompt injection).
- Do not keep per-user state in process memory (e.g. pending confirmations). Persist it (DB or Redis).
- Schema changes only through new files in `supabase/migrations/`. Never edit an applied migration.
- Currency is PEN (`S/`) by default, USD where explicit. Never hard-code `$`.

## Commands
- API: `npm run lint` (type-check until ESLint is added), `npm run test` (src/ + packages/), `npm run build`, `npm run start:dev`
- App (from `nina_app/`): `flutter analyze`, `flutter test`, `dart format .`, run with `flutter run --dart-define-from-file=env/dev.json` (env/dev.json is git-ignored)
- DB: local Supabase (Docker) first: `npx supabase@latest start`, `npx supabase@latest db reset`; RLS checks in `supabase/tests/*.sql`. Dev project only after that; never production.

## Workflow
- Start every non-trivial task in plan mode: read, propose a plan, wait for approval, then implement.
- Small, reviewable changes. One concern per commit/PR.
- Add or update tests with every change. Engine changes need golden-dataset tests.
- Run lint + tests before declaring a task done, and report what you ran and the result.
- If something is ambiguous or risky (auth, RLS, migrations, LLM data flow), stop and ask.
- At the end of each week, append a done/pending summary to `docs/weekly-log.md`.
- Graphify: code knowledge graph in `graphify-out/` (git-ignored, local). Built code-only (AST, no LLM, no API key); `.graphifyignore` keeps `.env` and `env/` out. Git hooks refresh it on commit; manual refresh: `graphify update .`. Use `graphify query "…"`, `graphify explain "X"`, `graphify affected "X"` before broad searches. Open `graphify-out/graph.html` to explore.
- Support tools: Ask the user what OmniRoute, The Architect and the Obsidian vault are in their setup before using or assuming them.

## Docs
- `docs/ARCHITECTURE.md` (how Nina works), `docs/EVALUACION.md` (audit + open issues), `docs/weekly-log.md`.

## Safety
- Never read, print, or commit `.env*` files or keys. Use `.env.example` for names only.
- Never connect to production data or use the production service-role key.
- Do not run destructive commands (drop, truncate, force push, migration resets) without explicit approval.

## Definition of done
Tests pass; RLS/guards verified for anything touching user data; no PII or amounts in logs; no duplicated metric logic; docs updated if behavior changed.
