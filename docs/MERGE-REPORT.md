# Merge report — develop finalized (2026-10-20)

Everything ran against the **local** Supabase (host `127.0.0.1`); every backend process I started used `AI_PROVIDER=mock` with the OpenAI, Gemini and Anthropic keys blanked. No `.env*` contents were read except the host of `SUPABASE_URL`. Synthetic data only. `main` was not touched (local and remote are both at `13ef76f`). Nothing was applied to production and nothing from `supabase/proposed_migrations/` or the runbook was applied anywhere.

## Step 1 — secrets scan
Scanned the added lines of `main..develop` and of each branch against `develop` for JWTs, API-key patterns, Supabase keys, `service_role` strings, private keys, password literals, tracked `.env` files, non-synthetic emails and phone-like numbers (a re-scan of the later commits found nothing new). Findings, all benign:

| Where | What |
|---|---|
| `docs/schema-prod-snapshot.sql`, `supabase/migrations/20260101...baseline...sql` (`GRANT ... TO "service_role"` lines), `docs/OVERNIGHT-LOG.md:15,55`, `supabase/config.toml:20` | the role name `service_role`, not a key |
| `supabase/config.toml:113,244` | commented-out default `admin@email.com` |
| `src/memory/memory.service.spec.ts:4`, `src/nina-router/redaction.spec.ts` (lines 7-12, 36, 42) | made-up phone numbers used as redaction test fixtures |
| `supabase/seed.sql:20,23` | the synthetic local sign-in password for the two seed users (local database only) |

No keys, JWTs, `.env` files or real personal data. Commit metadata contains the git author's own address, which is not in any diff.

## Step 2 and 3 — merges into local `develop` (all `--no-ff`)

| # | Branch | Result | lint | jest (suites / tests) | flutter analyze (errors) | flutter test |
|---|---|---|---|---|---|---|
| 1 | `chore/local-seed-verify` | ✅ | ok | 33 / 286 | 0 | 43 |
| 2 | `fix/log-hygiene` | ✅ | ok | 34 / 295 | 0 | 43 |
| 3 | `chore/remove-unwired-behavioral` | ✅ | ok | 34 / 294 | 0 | 43 |
| 4 | `feature/calm-mode-final` | ✅ | ok | 34 / 299 | 0 | 43 |
| 5 | `chore/prod-runbook` | ✅ | ok | 34 / 299 | 0 | 43 |
| 6 | `docs/overnight-2` | ⚠️ conflict, resolved | ok | 34 / 299 | 0 | 43 |
| 7 | `fix/http-cors` (new) | ✅ | ok | 35 / 304 | 0 | 43 |
| 8 | `fix/calm-intent-and-day-label` (new, from the end-to-end run) | ✅ | ok | 35 / 320 | 0 | 43 |
| 9 | `fix/ws-origin-check` (new, from the end-to-end run) | ✅ | ok | 36 / 325 | 0 | 43 |

`flutter analyze` always reports the same 29 pre-existing `info` items and no errors or warnings. `npm test` runs with `--maxWorkers=2` (added by merge 1). No full run failed after that change.

**Conflict (merge 6):** `docs/OVERNIGHT-LOG.md` — both sides had appended a section at the end of the file. Kept both: the local-verification section first, then the second-overnight-run section. No content was lost.

### What the new branches are
- `fix/http-cors`: the HTTP API used `origin: '*'`. It now uses the same `CORS_ALLOWED_ORIGINS` allowlist as the WebSocket (empty = no browser origin). Tests make real HTTP requests with and without an allowed origin; requests without an `Origin` header (native clients) are unaffected.
- `fix/calm-intent-and-day-label`: found by the end-to-end run. "me despidieron ayer" was read as "spending yesterday" because of the word "ayer" and answered with figures; debt and income-loss statements that are not questions about the numbers now get the fixed calm reply. The same run showed the engine template saying "En ayer gastaste"; day and week labels no longer take "en".
- `fix/ws-origin-check`: found by the end-to-end run. CORS does not apply to the WebSocket transport, so a page on any origin could connect with `transport: websocket` even though the allowlist was set. The adapter now checks the `Origin` header itself. Tests start a real server and use a real WebSocket client.

## Step 4 — end-to-end check on the merged `develop`
Database reset (`db reset`, local) with `supabase/seed.sql`; backend started from the merged code with `CORS_ALLOWED_ORIGINS=http://localhost:3000` for the origin checks.

| Check | Result |
|---|---|
| `GET /v1/overview` for user A, current and previous period | ✅ income, expenses and movement count equal direct SQL sums (Lima calendar day) |
| Audit block (formula, period, `txnCount`, `evidenceTxnIds`) | ✅ present; ids equal the SQL rows of the period (23 and 30 rows); `available` matches |
| Chat "cuánto gasté el último mes" and "...en el año" | ✅ figures equal SQL |
| Calm: debt, income-loss, distress | ✅ fixed replies, no emoji, no exclamation marks; distress is exactly the approved text with the helpline from `DISTRESS_HELPLINE`; distress also wins over a data question (no figures) |
| User B reads A's rows | ✅ 0 rows of A's transactions, accounts, spaces and shared rows; B sees only its own 14 rows |
| `rls_check.sql` | ✅ no public table without RLS (50 policies listed) |
| `spaces_rls.sql` | ✅ 10 / 10 |
| `accounts_rls.sql` | ✅ 3 / 3 |
| WebSocket, valid token | ✅ namespace connects, `ping` returns `pong` |
| WebSocket, no token | ✅ connected then disconnected by the server |
| WebSocket, origin not in the allowlist | ✅ refused (HTTP 400) after the fix; **before the fix it connected** (that is the bug above) |
| WebSocket, origin in the allowlist | ✅ connects |
| HTTP CORS | ✅ no `Access-Control-Allow-Origin` for an unlisted origin; echoed for the listed one |
| `flutter test` | ✅ 43 tests |

## Step 5 — push
`origin/develop` was fast-forwarded from `13ef76f` to the merged head (`git push origin develop`, 43 commits). The three new branches were pushed. All other branches were already on the remote. `main` was not pushed or changed.

## Not verified
- The phone UI (the Flutter app was only tested with widget tests, not run on a device or against this backend).
- Real LLM calls: every chat answer here came from the engine template; the grounded-LLM path was exercised only with unit tests and a mocked router. Behavior of the real providers, including whether they follow the crisis-line instruction without keywords, is untested.
- That the WebSocket joins room `user:<id>` end to end: no HTTP route emits an event, so it cannot be observed from outside. The existing gateway unit test covers the room join.
- Production: nothing was run against it; the runbook was rehearsed on a fresh local database built from the production snapshot, not on production data or volume.
- Preflight (`OPTIONS`) behavior from a real browser, and the Flutter web build with a configured origin.

## Remaining risks
1. **Production RLS** (runbook steps 6 and 7) changes insert behaviour on `transactions`; read the decision gates in section 3 of the runbook first.
2. **Crisis line wording** (Línea 113, "gratuita, las 24 horas") is the text you supplied; check it against the official source before release. Detection is keywords plus a prompt instruction, so unusual phrasing is handled by the model only if it follows the instruction.
3. **Deleted code** (25 unwired files in `src/ai`): compile, tests and app boot are green, but code without an entry point has no runtime test.
4. **`CORS_ALLOWED_ORIGINS` must be set in every environment that serves a web client.** Unset or empty means no browser origin, for HTTP and WebSocket. The variable name is in `.env.example`.
5. **Seed password** is in the repository (`supabase/seed.sql`), meant for the local database only.
6. Open production-schema oddities from the runbook (global unique `categories.normalized_name`, the subscriptions policy comparing `owner_id` with `couples.id`, `transactions.space_id` default, no `auth.users` triggers in the dump).
7. More unwired, non-behavioral scaffolding remains in `src/ai` (llm router, orchestrator, graph, insights, analytics, memory services).

## Running the production runbook later (by hand, in the SQL Editor)
Nothing below runs automatically, and none of it uses the CLI against production. Do not run `supabase link`, `db push` (with or without `--include-seed`), `db pull` or `db dump --linked`.

1. Get the runbook and read it:
   ```bash
   git checkout develop && git pull origin develop
   # open docs/PROD-MIGRATION-RUNBOOK.md
   ```
2. Optional rehearsal on a fresh local database built from the production snapshot (the same SQL you will paste):
   ```bash
   npx supabase@latest db reset --version 20260101000000 --no-seed
   node scripts/extract-runbook-sql.js
   docker exec -i supabase_db_Nina psql -U postgres -d postgres -v ON_ERROR_STOP=1 < runbook-script.sql
   ```
   It should end with "All verifications passed" and `ROLLBACK`. Delete `runbook-script.sql` afterwards (do not commit it).
3. Production, in this order, in the **production** project's SQL Editor:
   1. Confirm a recent backup (section 0).
   2. Run each query of section 2 (read-only) and apply the decision gates of section 3.
   3. Paste the script of section 4 as it is (ends with `rollback;`). It must print "All verifications passed".
   4. Change the last line to `commit;` and run it again.
   5. Re-run queries 2.4 and 2.7 (section 5), then try the app: add a movement, add one to a space, create an account.
4. If you decide couples are retired, skip step 7 of the script and the verification check "1b" (the runbook says where).
5. Rollback options are in section 6 of the runbook (nothing to undo before `commit`; fix forward afterwards; backup restore as the last resort).

## Needs founder decision
1. Couples: keep (apply runbook step 7) or retire (skip it)? The read-only queries give the usage numbers.
2. Crisis line: confirm the official name and the "free, 24 hours" claim.
3. Delete the remaining non-behavioral scaffolding in `src/ai`?
4. Production-schema oddities listed above: fix in a later migration or leave?
5. Open PRs from the pushed branches (there is no `gh` here); `develop` is already on the remote.
