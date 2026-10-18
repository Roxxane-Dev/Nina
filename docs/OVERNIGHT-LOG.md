# Overnight log — plan (local database only)

Status: **plan written, waiting for founder OK. Nothing below has been started except the DB baseline work (section 0).**
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
- DB baseline: see section 0. No other task started.
