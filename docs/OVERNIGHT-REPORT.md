# Overnight report — second run (2026-10-19)

Everything ran against the **local** Supabase (host `127.0.0.1`), with `AI_PROVIDER=mock` and the LLM keys blanked for every process I started. No `.env*` contents were read except the host of `SUPABASE_URL`. Synthetic data only. Nothing was merged or pushed to `main`; I merged nothing at all in this run. Details per task: `docs/OVERNIGHT-LOG.md`.

## Results

| # | Task | Branch | Status | Tests run |
|---|---|---|---|---|
| 0 | Seed, local verification, maxWorkers | `chore/local-seed-verify` (pushed; PR not opened, see below) | ✅ | lint; jest 286 (maxWorkers=2); RLS SQL tests |
| 1 | Calm mode: final distress text, crisis line in one constant, prompt rule, distress overrides data questions | `feature/calm-mode-final` | ✅ | lint; jest 291; flutter n/a (no Dart change) |
| 2 | Retire duplicate engine path | already built earlier: `refactor/retire-legacy-engine` (pushed) | ✅ no new work; re-verified against the seed: overview and chat figures equal direct SQL sums for user A | lint; jest; flutter analyze 0 errors, test 43 |
| 3 | Audit view (PRD-AUD-06) | already built earlier: `feature/audit-view` (pushed) | ✅ no new work; audit block consistent with the figures on the seed | same as above |
| 4 | Log hygiene | `fix/log-hygiene` | ✅ | lint; jest 295 |
| 5 | Remove unwired behavioral code | `chore/remove-unwired-behavioral` (stacked on `fix/log-hygiene`) | ✅ | lint; jest 294; app boots, DI resolves |
| 6 | Scope cleanup | already built earlier: `chore/scope-cleanup` (pushed) | ✅ re-verified by search; one leftover type removed on the task 5 branch | covered above |
| 7 | Production runbook + couple_id check + replay | `chore/prod-runbook` | ✅ replay clean | lint; jest 286; replay (below) |
| 8 | Docs | `docs/overnight-2` | ✅ | docs only |

Flutter: `flutter analyze` 0 errors (29 pre-existing infos), `flutter test` 43 pass, run on `develop` at the end. Dart code did not change in this run.

### Replay of the runbook on a fresh local database
Database reset to the production-snapshot baseline only (13 tables, legacy INSERT policy present). The SQL block of section 4 of the runbook, extracted from the file:
- **Dry run (ends with `rollback`)**: "All verifications passed", state unchanged afterwards.
- **Real run (`commit`)**: "All verifications passed"; 19 tables, one INSERT policy ("Users insert own transactions").
- Schema after the replay equals the repo's migration chain, except for the intended step-7 policy change.
- `spaces_rls.sql` 10/10, `accounts_rls.sql` 3/3, `couple_insert_rls.sql` 6/6; no table without RLS. The couple test fails without the migration (a non-member could insert into someone else's couple), which proves it checks something.

### Test stability
Four full runs without the graphify hook active, two with the default worker count and two with `--maxWorkers=2`, plus two controls with the hook active: the only failure was one default-worker run with the hook idle. Both `--maxWorkers=2` runs passed (35-36s), and the two default-worker runs took 53s and 102s. `npm test` now uses `--maxWorkers=2` (on `chore/local-seed-verify`). All runs in this report used it.

## Top risks to review first
1. **Production RLS changes** (runbook steps 6 and 7). Step 6 drops a policy production uses today; step 7 re-adds couple inserts with a membership check. Run section 2 queries first; the runbook has the gates.
2. **Distress reply.** The text and the 113 line come from you. The wording of the crisis line should be checked against the official source before release. Detection is keywords plus a prompt rule, so phrasing outside both goes to the LLM, which is only instructed, not forced, to give the line.
3. **Deleting 25 files** in `chore/remove-unwired-behavioral`. Compile, tests and app boot are green, but nothing exercises code that had no entry point. If anything outside the repo imports those services, it breaks.
4. **Unmerged stack.** Local `develop` contains the first overnight run's merges but is not pushed; remote `develop` is stale. A PR from any branch to the remote `develop` shows all of that work. Push `develop` once before opening PRs.
5. **HTTP CORS is still `*`** in `main.ts` (only the WebSocket was restricted).
6. **Seed credentials.** `supabase/seed.sql` contains a synthetic local password and is read by `supabase db reset` only. Never use it on a hosted project.
7. **Flaky jest** was observed ~6 times in total before the worker cap; it is unproven that the cap fixes it.

## Review commands
Each branch from `develop`, unless noted:

```bash
git log --oneline develop..chore/local-seed-verify  && git diff develop...chore/local-seed-verify --stat
git log --oneline develop..feature/calm-mode-final  && git diff develop...feature/calm-mode-final
git log --oneline develop..fix/log-hygiene          && git diff develop...fix/log-hygiene
git log --oneline fix/log-hygiene..chore/remove-unwired-behavioral && git diff fix/log-hygiene...chore/remove-unwired-behavioral --stat   # stacked
git log --oneline develop..chore/prod-runbook       && git diff develop...chore/prod-runbook
git log --oneline develop..docs/overnight-2         && git diff develop...docs/overnight-2
```

To re-run checks: `npm run lint && npm test`; `cd nina_app && flutter analyze && flutter test`; local database: `npx supabase@latest db reset`, then `supabase/tests/*.sql` via `docker exec -i supabase_db_Nina psql -U postgres -d postgres < supabase/tests/<file>.sql`.

## Suggested merge order
0. Push local `develop` (it already holds the first overnight run's work).
1. `chore/local-seed-verify` (maxWorkers + seed + log)
2. `feature/calm-mode-final`
3. `fix/log-hygiene`
4. `chore/remove-unwired-behavioral` (needs 3 first)
5. `chore/prod-runbook`
6. `docs/overnight-2` (CLAUDE.md and PRD addendum; `docs/OVERNIGHT-LOG.md` also changed on branch 1, expect a trivial conflict at the end of that file)

Production migrations come after the runbook PR is approved, applied by you by hand.

## Needs founder decision
1. **PR creation.** `gh` is not installed here, so no PR was opened. Compare link for the first one: https://github.com/Roxxane-Dev/Nina/compare/develop...chore/local-seed-verify
2. **Couples:** keep couples (apply step 7 of the runbook) or retire them (skip step 7)? Section 2 of the runbook gives the usage numbers.
3. **Push local `develop`?** Needed before PRs show a sane diff.
4. **Crisis line text:** please confirm the official name and the 24-hour/free claims before release; it is now a single constant.
5. **HTTP CORS `*`:** restrict it with the same variable, or leave?
6. **More unwired scaffolding in `src/ai`** that is not behavioral (llm router, orchestrator, graph, insights, analytics, memory services): delete too?
7. **Production schema oddities** still open: global unique `categories.normalized_name`, subscriptions policy comparing `owner_id` with `couples.id`, `transactions.space_id text default 'personal'`, no `auth.users` triggers in the dump (runbook query 2.8 checks it).
