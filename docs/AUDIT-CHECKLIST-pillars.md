# Nina — Pillar audit checklist (hand this to Claude Code)

## Instructions for the auditor
Audit only. **Do not implement, edit code, apply migrations or touch `.env*`.** Work against local/dev only.
Start in plan mode. Use `graphify query` / `graphify affected` before broad searches.
For every item below, report: **Status** (✅ met · ⚠️ partial · ❌ missing · ❓ cannot verify), **Evidence** (`file:line`, test name, or command output), **Gap** (one line), **Suggested priority** (P0/P1/P2).
Run `npm run lint`, `npm run test`, `flutter analyze`, `flutter test` and report the results first.
Reference: `docs/PRD-positioning-addendum.md` (IDs in brackets), `docs/HISTORIAS_DE_USUARIO.md`, `CLAUDE.md`.
Finish with: top 5 gaps by risk, a list of items you could not verify and why, and a proposed order of work. Wait for approval before any change.

---

## Pillar 1 — Financial Twin
- [ ] 1.1 Is there exactly one "available this month" computation, in `packages/finance-engine`, consumed by Home and chat? [FT-01]
- [ ] 1.2 Does any other code compute it (Dart, `src/intelligence/nina-finance.engine.ts`, chat service)? List each duplicate.
- [ ] 1.3 Is there any projection or forecast code today? Where, behind which flag, and is it deterministic? [FT-02]
- [ ] 1.4 Is there a what-if entry point (chat intent or screen)? What does it return? [FT-03]
- [ ] 1.5 What happens with under 2 months of data: empty state, wrong number, or crash? [FT-05]
- [ ] 1.6 Do engine golden-dataset tests exist for summary and trends? List the datasets.
- [ ] 1.7 Are dates compared as parsed dates everywhere (the earlier string-compare bug)? Grep for `t.date ===` and similar.

## Pillar 2 — Neutral aggregation
- [ ] 2.1 Which input paths exist: manual, chat, CSV, PDF? Which are wired end to end? [AGG-01/03/04]
- [ ] 2.2 Is `accounts` used by transactions, and does the sum of per-account balances equal the engine total? Is there a test? [AGG-02]
- [ ] 2.3 Is the source of each transaction recorded (manual / chat / import)? [AGG-05]
- [ ] 2.4 Are duplicates handled on any import path?
- [ ] 2.5 Any bank-specific or provider-specific lock-in in the code or schema?
- [ ] 2.6 Are migrations 013–019 applied in DEV? Which are pending, and what degrades while they are?

## Pillar 3 — Deterministic engine and auditability
- [ ] 3.1 Trace one chat answer containing a figure from request to reply. Where is the number produced and where could the LLM alter it? [AUD-01]
- [ ] 3.2 Where is the number validator? What does it check, what does it miss (formatting, thousands separators, percentages, dates), and what happens on rejection? [AUD-02]
- [ ] 3.3 What exactly is sent to each LLM provider? Confirm no raw transactions, balances or PII. Attach the real payload shape. [AUD-05]
- [ ] 3.4 Is transaction description text sanitised or fenced as untrusted? Is there a prompt-injection test? [AUD-05]
- [ ] 3.5 Does any response carry data to explain how a figure was calculated (formula, period, row count)? [AUD-03/04]
- [ ] 3.6 Is any per-user state held in process memory (pending confirmations, caches)?
- [ ] 3.7 Which LLM providers are active vs behind flags? Is model routing deterministic?

## Pillar 4 — Invisible proactive insights
- [ ] 4.1 What do `proactive-engine.service.ts`, `financial-insights.service.ts` and `subscription-intelligence.service.ts` actually do today? What flags gate them? [INS-01/02]
- [ ] 4.2 Do they use the engine or compute their own metrics? List duplicates.
- [ ] 4.3 Can anything send a notification or message today? Via what channel? Is there a rate cap? [INS-03/04]
- [ ] 4.4 Is there a deviation rule (category vs trailing 3 months)? Its threshold, minimum history, and dedup behaviour.
- [ ] 4.5 Can a user dismiss or confirm an insight, and is it persisted?
- [ ] 4.6 Do these paths log amounts or PII?

## Pillar 5 — Radical privacy
- [ ] 5.1 List every user-owned table and its RLS policy. Flag any table without RLS. Run `supabase/tests/rls_check.sql`, `spaces_rls.sql`, `accounts_rls.sql` on DEV and report. [PRV-02]
- [ ] 5.2 Is every controller and WebSocket gateway behind `SupabaseAuthGuard`, with `userId` taken only from the JWT?
- [ ] 5.3 Does the service-role client ever receive a client-supplied user id or space id without an ownership/membership check?
- [ ] 5.4 Consent: does the AI path actually refuse when consent is absent? Show the guard and a test. [PRV-01]
- [ ] 5.5 Is there any export or delete endpoint or screen? What would be missed (storage, derived tables, logs, LLM-side caches)? [PRV-04/05]
- [ ] 5.6 Grep logs for amounts, descriptions, emails, tokens. Report any hit. [PRV-03]
- [ ] 5.7 Are secrets read from env only, with `.env.example` listing names without values?
- [ ] 5.8 What do provider terms say about training on submitted data, for each active provider? Mark ❓ if you cannot confirm. [PRV-06]

## Cross-cutting — Voice and UX
- [ ] 6.1 Find the production chat system prompt. Compare it with `docs/nina-voice-pack.md`; list differences. [VOX-01]
- [ ] 6.2 Is there any deterministic calm-mode trigger? [VOX-02]
- [ ] 6.3 Grep user-facing strings for hard-coded `$`, usted forms, stacked exclamation marks, more than one emoji, or error text that leaks internals.
- [ ] 6.4 Are empty, loading and error states present on Home, Movimientos, Análisis, Chat and Más?
- [ ] 6.5 Does any screen or copy promise something that is not built (forecast, "all your banks", audit button)?

## Output template
| # | Status | Evidence | Gap | Priority |
|---|---|---|---|---|
| 1.1 | | | | |
