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

## Second overnight run (2026-10-19)
Summary table, risks, review commands, merge order and open decisions: `docs/OVERNIGHT-REPORT.md`. All work local (host 127.0.0.1), AI_PROVIDER=mock with LLM keys blanked, nothing merged.

| Task | Branch | Result |
|---|---|---|
| Seed + local verification + maxWorkers | `chore/local-seed-verify` | pushed; `gh` missing, PR not opened |
| 1 Calm mode | `feature/calm-mode-final` | done; exact approved text, helpline in `DISTRESS_HELPLINE`, prompt rule, distress overrides data questions; jest 291 |
| 2 Retire duplicate engine | `refactor/retire-legacy-engine` (earlier) | already built; figures equal SQL sums for user A on the seed |
| 3 Audit view | `feature/audit-view` (earlier) | already built; audit consistent on the seed |
| 4 Log hygiene | `fix/log-hygiene` | done; codes only; tests assert no text or amount reaches the logger; jest 295 |
| 5 Remove unwired behavioral | `chore/remove-unwired-behavioral` | done; stacked on task 4 (modify/delete conflict otherwise); app boots; jest 294 |
| 6 Scope cleanup | `chore/scope-cleanup` (earlier) | already built; re-verified |
| 7 Runbook | `chore/prod-runbook` | done; proposed couple_id migration tested locally (6/6, fails without it); replay on a fresh baseline database clean |
| 8 Docs | `docs/overnight-2` | done |

### Files removed by task 5 (25)
`src/ai/analytics/financial-health-v2.service.ts`, `src/ai/analytics/financial-health.service.ts` (deprecated wrapper with hard-coded figures), `src/ai/rag/rag.service.ts`; `src/ai/behavioral/` (adaptive-nudges, intervention-engine, life-stage, recovery-engine, reinforcement-engine, streak-engine); `src/ai/emotion/emotional-context.engine.ts`; `src/ai/prevention/` (behavioral-regression, predictive-signals, prevention-coaching, relapse-detection, risk-trajectory); `src/ai/proactive/` (coaching-engine, notification-engine, observability, proactive-engine, risk-monitor, trigger-engine); `src/ai/profiles/` (behavior-signals, onboarding, user-profile-evolution); `src/ai/social/household-intelligence.service.ts`. Edited: `src/ai/ai.module.ts`, `src/ai/context/context-packet.ts` (unused type), `src/common/log-hygiene.spec.ts`. The `financial_streaks` table is untouched. The only remaining flag set is `advanced_household_mode: false` and `realtime_streaming: true`.

### Test runs (graphify hook idle unless noted)
A1 default workers 53s pass; A2 default workers 102s one suite failed to start; B1 and B2 `--maxWorkers=2` 36s and 35s pass; controls with the hook active: C1 default 96s pass, C2 `--maxWorkers=2` 27s pass.

### Not verified
Live LLM calls; Flutter app against the local backend; WebSocket client; production data volume; the crisis line's official wording.
