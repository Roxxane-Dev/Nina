# Overnight report — 2026-10-18

Work on local Supabase (Docker) and local code only. `main` untouched, production untouched, no `.env*` read. All branches are pushed to origin and merged into `develop` locally (`develop` itself is **not** pushed with these merges). Details and decisions: `docs/OVERNIGHT-LOG.md`.

## Results

| Task | Branch | Status | Tests run |
|---|---|---|---|
| DB baseline | `chore/db-baseline` | ✅ (found and fixed an RLS hole) | local `db reset` clean; `spaces_rls.sql`, `accounts_rls.sql` pass; lint; jest 212; analyze 0 errors; flutter 37 |
| T0 date bug | `fix/date-bridge` | ✅ not broken; regression tests added | lint; jest 216 |
| T1 DB (013-019, missing tables) | `chore/db-baseline` | ⚠️ done from the prod snapshot; tables with no create migration (`subscriptions`, `ai_insights`, `memories`) come from the snapshot. `memories` does not exist in production and is not used by code (the code reads `messages`). | see above |
| T2 PII before embeddings | `fix/redact-pii-embeddings` | ✅ | lint; jest 239 (on develop) |
| T3 retire legacy engine | `refactor/retire-legacy-engine` | ✅ | lint; jest 237; analyze 0 errors; flutter 37 |
| T4 audit view | `feature/audit-view` | ✅ | lint; jest 241; analyze 0 errors; flutter 43 |
| T5 voice + calm mode | `feature/voice-calm-mode` | ✅ | lint; jest 277 (no Dart change) |
| T6 scope cleanup | `chore/scope-cleanup` | ✅ | lint; jest 286; analyze 0 errors; flutter 43 |
| T7 docs | `docs/overnight-updates` | ✅ | docs only |

Flutter analyze reports 29 pre-existing `info` items (was 30), no errors or warnings.

## Top risks to review first
1. **Production RLS change.** `20260107...drop_legacy_transaction_insert_policy.sql` removes a production policy; couple-based inserts stop working. Confirm `couples` is unused in production before applying.
2. **Do not apply the baseline to production.** It only mirrors it. Production needs migrations `20260102`-`20260107` (see the log), applied by you after review, in order.
3. **T3 deletions.** About 30 files removed (legacy engine, `/home/intelligence`, nightly job, unrouted mock screens and widgets). Each was checked as unreferenced from routes and tests, but a screen I classed as dead could be linked from somewhere I did not search (e.g. deep links).
4. **Calm mode is keyword-based.** It will miss phrasing it does not list and could trigger on borderline phrases. The distress reply has no helpline (none verified).
5. **`CORS_ALLOWED_ORIGINS`** is a new env variable; unset means no browser origin may open the WebSocket (Flutter web would break until it is set). HTTP CORS is still `*`.
6. **Flaky full jest runs** (suites failing to start, pass on rerun). Probably CPU contention with the graphify hook; unconfirmed.
7. **Still logging sensitive content** in legacy AI services (see the log, decision 5).

## Commands to review each branch
Branches were created one after another from `develop`, so each includes the previous ones. Use the incremental diff:

```bash
# 0) overall
git log --oneline --graph main..develop
git diff --stat main...develop

# 1) DB baseline + RLS fix
git log --oneline main..chore/db-baseline
git diff main...chore/db-baseline --stat

# 2) date bridge tests
git diff chore/db-baseline...fix/date-bridge

# 3) PII before embeddings (branched from main; independent)
git log --oneline main..fix/redact-pii-embeddings
git diff main...fix/redact-pii-embeddings

# 4) retire legacy engine
git diff fix/redact-pii-embeddings...refactor/retire-legacy-engine --stat

# 5) audit view
git diff refactor/retire-legacy-engine...feature/audit-view

# 6) voice + calm mode
git diff feature/audit-view...feature/voice-calm-mode

# 7) scope cleanup
git diff feature/voice-calm-mode...chore/scope-cleanup

# 8) docs
git diff chore/scope-cleanup...docs/overnight-updates --stat
```

To re-run the checks: `npm run lint && npm test` and, from `nina_app/`, `flutter analyze && flutter test`. For the database: `npx supabase@latest db reset`, then run `supabase/tests/*.sql` through `docker exec -i supabase_db_Nina psql -U postgres -d postgres < supabase/tests/<file>.sql`.

## Suggested merge order
Because the work is stacked, the simplest path is one reviewed PR `develop → main`. If you prefer separate PRs, merge in this order: `chore/db-baseline` → `fix/date-bridge` → `fix/redact-pii-embeddings` → `refactor/retire-legacy-engine` → `feature/audit-view` → `feature/voice-calm-mode` → `chore/scope-cleanup` → `docs/overnight-updates`. Apply the production migrations only after the DB PR is approved.
