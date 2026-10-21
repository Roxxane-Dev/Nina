# Overnight log — plan (local database only)

Status: **run finished 2026-10-18.** Plan below; results in "Run log". Summary and review commands: `docs/OVERNIGHT-REPORT.md`.
Branch for the DB work: `chore/db-baseline` (from `develop`). Not committed, not pushed.

## Guardrails (from the founder's instructions)
- Never commit, push or merge to `main`. `develop` is the integration branch; each task gets its own `feature/*` or `fix/*` branch from `develop`. A green branch is pushed and merged into `develop` locally only if lint and all tests pass.
- Database: **local Supabase (Docker) only**. Forbidden: `supabase link`, `db push`, `db pull`, `db dump --linked`, or any command against production. Synthetic data only.
- Never read or print `.env*` or keys. No amounts, descriptions or PII in logs or in this file.
- Scope: P0 and audit fixes only. No Financial Twin, imports, push, export/delete, behavioral features.
- After every task: `npm run lint`, `npm test`, `flutter analyze`, `flutter test`. Two failed attempts → revert that branch to its last green commit, log it, move on.
- Anything that needs a founder decision goes under "Needs founder decision"; do not guess.

## 0. DB baseline (done locally, uncommitted)
- Snapshot reviewed: schema only. No `COPY`, no data. The only two `INSERT`s are inside the trigger functions `create_user_profile()` (inserts the new user's id into `user_profiles`, `ON CONFLICT DO NOTHING`) and `handle_new_user()` (`SECURITY DEFINER`; inserts id, email and name into `profiles`). No keys or secrets (`service_role` appears only in `GRANT` lines).
- `supabase/migrations/*` (18 files) moved with `git mv` to `supabase/migrations_legacy/`.
- New `supabase/migrations/20260101000000_baseline_prod_snapshot.sql` = local preamble (`uuid-ossp` in `extensions`, `vector` in `public`, because the snapshot references `"public"."vector"`) + the snapshot verbatim + a final `search_path` reset.
- `supabase start` and `supabase db reset` (local) run clean.
- Comparison with the snapshot: after normalizing (owners, grants, quoting, ordering) the dump of the local `public` schema is **identical** to the snapshot. 13 tables, 35 policies (snapshot: 35), RLS on every table, `transactions.date` is `timestamp with time zone`, 3 functions, `vector` in `public`, Postgres 17.11.
- Extra check, rolled back: legacy `013, 015, 016, 017, 018, 019` applied in sequence on top of the baseline with no errors (012 not needed).

## Needs founder decision
1. **Baseline vs. the code.** Production lacks everything from legacy 016–019 (`category_rules`, `spaces`, `space_members`, `space_invites`, `consents`, `accounts`, `transactions.shared_space_id` and related). Proposal: after the baseline, add 013 (idempotent policies), 016, 017, 018 and 019 as new timestamped migrations (copied unchanged; 015 is already satisfied since `date` is `timestamptz`). Production would then need exactly those, applied by you after review.
2. **Prod schema oddities to review (not changed):**
   - `transactions.space_id text default 'personal'` exists in production, next to the `shared_space_id` that legacy 017 adds.
   - `categories.normalized_name` has a global `UNIQUE`, so two users cannot have the same category name.
   - Policy "Users can manage their subscriptions" compares `owner_id` with `couples.id`, which looks like a bug.
   - `ai_insights` has an all-commands policy that also lets couple members write.
   - `goals`, `user_profiles` and `couples` have no write policies for some commands; the backend uses the service role.
   - The public-schema dump does not include triggers on `auth.users`, so `handle_new_user` / `create_user_profile` may not be attached locally. Check in production by hand.
   - Tables in production that no migration or code in this repo uses: `academy_progress`, `couples`.
3. Whether `financial_streaks` stays in the baseline (it does, unchanged) while its code is made unreachable (T6).

## Task plan (runs only after your OK)
Order and scope as in your brief; the DB tasks now use the local baseline.

| Task | Branch (from `develop`) | Plan |
|---|---|---|
| DB | `chore/db-baseline` | Commit baseline + legacy move. Add decision-1 migrations if approved. Run `rls_check.sql`, `spaces_rls.sql`, `accounts_rls.sql` on local; fix SQL tests that assume the legacy layout. |
| T0 | `fix/date-bridge` | Add tests first, then verify "último mes" end to end with `timestamptz` in `map-transactions.ts`; differentiated errors. |
| T2 | `fix/redact-pii-embeddings` | Already pushed (2 commits). Merge into `develop` after your review. |
| T3 | `refactor/retire-legacy-engine` | Point Chat page and Home to `/v1/overview`; remove `/intelligence/snapshot`, `nina-finance.engine.ts`, `getSnapshot`, metric code in `home-intelligence.service.ts` and `insight_engine.dart` once `graphify affected` shows no references. |
| T4 | `feature/audit-view` | Audit block on `/v1/overview` (formula, period, `txn_count`, `evidenceTxnIds`), golden test, API test, Flutter bottom sheet "Cómo calculé esto", widget tests. |
| T5 | `feature/voice-calm-mode` | Voice block into `CHAT_SYSTEM_PROMPT_V1`; validator untouched; deterministic calm-mode rule with tests. |
| T6 | `chore/scope-cleanup` | Flags off or removed; remove the invented "80%" claim and hard-coded `$`; remove mocked score/signals; env-configured WebSocket CORS allowlist. Also stop logging amounts/memory content (list in the audit). |
| T7 | `docs/overnight-updates` | CLAUDE.md and PRD addendum statuses. |

## Environment for the backend to use the local database (names only; you set the values)
Get the values from `npx supabase@latest status -o env` (local, no production involved).

| Variable | Where | Local value |
|---|---|---|
| `SUPABASE_URL` | backend `.env` | `http://127.0.0.1:54321` |
| `SUPABASE_ANON_KEY` | backend `.env` | local anon key from `status` |
| `SUPABASE_SERVICE_ROLE_KEY` | backend `.env` | local service-role key from `status` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `nina_app/env/dev.json` (dart-define) | same URL (use `http://10.0.2.2:54321` on the Android emulator) and the local anon key |
| `API_BASE_URL` | `nina_app/env/dev.json` | your local API (`http://127.0.0.1:<PORT>`, or `10.0.2.2` on the emulator) |

Notes: `CHAT_CONFIRM_SECRET` and the LLM keys are unrelated to the database. Local auth has no users: sign up in the app; confirmation emails land in Mailpit at `http://127.0.0.1:54324`.

## Run log
All work on local Supabase (Docker) and local code. Nothing was applied to production; `main` was never touched. Every branch is pushed and merged into `develop` locally (develop itself was not pushed after the merges). No amounts, descriptions or PII are written here.

| Task | Branch | Result | Checks (lint / jest / analyze / flutter test) |
|---|---|---|---|
| DB | `chore/db-baseline` | Baseline + re-based migrations 013/016-019 + RLS fix. Local `db reset` clean; `spaces_rls.sql` and `accounts_rls.sql` pass; `rls_check.sql` lists policies and no public table lacks RLS. | ok / 212 / 0 errors (30 infos) / 37 |
| T0 | `fix/date-bridge` | Not broken: the bridge already handles timestamptz. Added end-to-end regression tests; confirmed the live PostgREST output shape on the local DB with synthetic rows (removed afterwards). | ok / 216 / n/a / n/a |
| T2 | `fix/redact-pii-embeddings` | PII redaction before embeddings + RUC, CCI, grouped card and +51 patterns; model log removed. | ok / 239 on develop / n/a / n/a |
| T3 | `refactor/retire-legacy-engine` | Removed legacy engine, `/intelligence/snapshot`, `/home/intelligence`, nightly job; Chat page no longer fetches the snapshot; deleted dead mock screens and metric code in Dart. | ok / 237 / 0 errors (29 infos) / 37 |
| T4 | `feature/audit-view` | `audit` block on `/v1/overview`, golden + API tests, Home sheet "Cómo calculé esto" linking to Movimientos for the period, widget tests. | ok / 241 / 0 errors (29 infos) / 43 |
| T5 | `feature/voice-calm-mode` | Voice, calm-mode and limits in `CHAT_SYSTEM_PROMPT_V1`; deterministic calm mode; validator untouched; templated fallbacks tested. | ok / 277 / n/a (no Dart change) / n/a |
| T6 | `chore/scope-cleanup` | Behavioral flags deleted, legacy prompt uses soles, WebSocket CORS allowlist. The "80%" claim and the mocked score/signals had already been removed with T3's deletions. | ok / 286 / 0 errors (29 infos) / 43 |
| T7 | `docs/overnight-updates` | CLAUDE.md state section, PRD addendum statuses and change log; merged `docs/positioning-pillars` first. | docs only |

### Flaky test infrastructure
In full `npm test` runs, 1-4 suites sometimes fail to run (suite-level failure, zero failing tests) and pass on the next run; the affected suite changes between runs (accounts, income-date, shared-registration, gateway, spaces). Seen about five times. The graphify git hook starts a background rebuild on every commit and branch switch; my guess is CPU contention with ts-jest, not confirmed.

## Needs founder decision
1. **Security fix, production impact.** Migration `20260107000000_drop_legacy_transaction_insert_policy.sql` drops production's permissive INSERT policy "Users can insert their personal and shared transactions." on `transactions`. Because permissive policies are OR-ed, it let a user insert a row into any `shared_space_id` or with another user's `account_id` once 017/019 exist. Effect: couple-based inserts (`couple_id`) stop working. Please confirm nothing in production still uses `couples` before applying.
2. **Production migrations to apply, by hand, after review:** `20260102` (013 policies), `20260103` (category rules), `20260104` (shared spaces), `20260105` (consents), `20260106` (accounts), `20260107` (policy drop). The baseline file must NOT be applied to production (it only mirrors it).
3. **Env var introduced:** `CORS_ALLOWED_ORIGINS` (comma-separated). No such variable existed in the code. I did not edit `.env.example` (rule: no `.env*` edits); please add the name. With it unset, browsers on other origins cannot open the WebSocket (Flutter web needs its origin listed). HTTP CORS in `main.ts` is still `origin: '*'`; the brief covered only the WebSocket.
4. **Behavioral scaffolding left in place** (no entry point, not wired): `src/ai/emotion`, `src/ai/prevention`, `src/ai/profiles`, `src/ai/proactive`, `src/ai/social`, `financial_streaks` table. Delete or keep?
5. **Remaining logs with sensitive content** (not in the chat path): memory content in `src/ai/memory/*`, notification message in `notification-engine.service.ts`, `ungrounded_number:<n>` and raw provider errors in `nina-router.service.ts` / `ai.service.ts`. Not changed (outside the brief).
6. **Prod schema oddities** (from the earlier review, unchanged): `transactions.space_id text default 'personal'`, global unique `categories.normalized_name`, subscriptions policy comparing `owner_id` with `couples.id`, no triggers on `auth.users` captured in the dump.
7. **Calm mode distress reply** has no helpline: I did not want to cite a number I cannot verify.

## Could not verify
- Live LLM payload capture (needs running API and provider keys).
- Behavior against the real Supabase auth flow in the app (only SQL-level and unit-level checks were run).
- Flutter checks after T5 (no Dart changes) and the docs-only branch.
- The chain applied to a fresh database *starting from production*: only a fresh local database was used.

## Local environment verification (branch `chore/local-seed-verify`)
Target check: host of `SUPABASE_URL` is `127.0.0.1` (port 54321); only the host was read from `.env`, no keys printed. Backend started with `AI_PROVIDER=mock` and the OpenAI, Gemini and Anthropic keys blanked for that process only, so nothing left the machine. All data is synthetic (`supabase/seed.sql`).

### A. Baseline and schema
- Baseline task: done earlier (`supabase/migrations_legacy` + `20260101...baseline_prod_snapshot.sql` + re-based migrations `20260102`-`20260107`). `supabase db reset` runs clean, including the seed.
- Local schema vs `docs/schema-prod-snapshot.sql` (normalized dump comparison): every object in the snapshot is present locally. Differences are only the expected ones:
  - added: 6 tables (`spaces`, `space_members`, `space_invites`, `category_rules`, `consents`, `accounts`), columns `transactions.shared_space_id` and `transactions.account_id`, function `is_space_member`, and their policies;
  - changed: `Users update own transactions` now also checks space membership and account ownership;
  - removed: the legacy INSERT policy "Users can insert their personal and shared transactions.", replaced by "Users insert own transactions".
- `transactions.date` is `timestamp with time zone`. 19 tables, RLS enabled on all 19.

### B. Seed
`supabase/seed.sql` (committed once you approve): users A and B (local email + password sign-in), profiles, 4 accounts, 9 system categories, consents, one shared space with only A as member. A has 109-110 movements over 4 months (salary, rent, supermarket, delivery, transport, subscriptions, services, cinema; 8 rows assigned to the shared space), B has 14 over 2 months. Dates are relative to **today in Lima**. A first version used the database's UTC date and created one row dated "tomorrow" in Lima; the API correctly excluded it, which exposed the seed bug, now fixed.

### C. Backend (HTTP checks with real JWTs from local GoTrue)
| Request | Status | Result |
|---|---|---|
| `GET /v1/overview` without token | 401 | guarded |
| A `GET /v1/overview?period=current` | 200 | income 4800, expenses 2427.44, 21 movements; audit block consistent |
| A `GET /v1/overview?period=previous` | 200 | income 5400, expenses 2904.50, 30 movements |
| B `GET /v1/overview?period=previous` | 200 | income 2500, expenses 949, 8 movements |
| A chat "cuánto gasté el último mes" | 201 | "gastaste S/ 2,904.50 e ingresaste S/ 5,400.00" |
| A chat "cuánto gasté en el año" | 201 | "gastaste S/ 11,142.65 e ingresaste S/ 19,800.00" |
| A chat "tengo deudas, cuánto me queda este mes" | 201 | calm mode: "Vamos con calma. ... te quedan S/ 2,372.56." (no LLM, no emoji) |

Direct SQL on the local DB gives the same numbers in every case (previous month 5400.00 / 2904.50 / 30 rows; current month 4800.00 / 2427.44 / 21 rows, counting up to Lima today; year 19800.00 / 11142.65; B previous 2500.00 / 949.00 / 8 rows).

Findings while testing:
- The date bug is **not present**: timestamptz rows, "último mes" and "en el año" resolve correctly end to end. No code change and no new regression test were needed (end-to-end tests were added earlier in `src/finance-engine/analytics-dates.spec.ts`).
- My first chat attempt returned "No entendí bien esa pregunta" for both questions. Cause: my shell sent the accented characters in the wrong encoding. With JSON `\u` escapes (what a real client sends) both work. Not a backend bug.
- Database dates are UTC and the engine uses Lima days. Any SQL used to cross-check a figure must use `(now() at time zone 'America/Lima')::date`.

### D. RLS (local database)
| Check | Result |
|---|---|
| `rls_check.sql` | listing of 50 policies; query 1 (public tables without RLS) returns zero rows |
| `spaces_rls.sql` | 10 of 10 pass (B sees shared + own; B never sees A's personal row; B sees the space and both members; B cannot read invites; outsider C sees nothing and cannot insert into the space; A sees shared + own; A never sees B's personal row); rolled back |
| `accounts_rls.sql` | 3 of 3 pass (D2 cannot see or use D1's accounts; D1 uses own); rolled back |
| PostgREST with real JWTs | B reading A's transactions, accounts, space and shared transactions: 0 rows each. B reads only own 14 rows. A reads own rows, the space and the 8 shared rows. Request without a user token: 0 rows. |

### Not verified
- No live LLM call (all provider keys blanked); the grounded-LLM path was exercised only through the template fallback and unit tests.
- Flutter app against the local backend (not run).
- WebSocket gateway with a real client.
- Behavior with production data volume.
- The distress/calm text pending from the founder.
