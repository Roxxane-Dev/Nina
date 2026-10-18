# NINA-PRD-001 — Addendum A: Positioning pillars

| Field | Value |
|---|---|
| Document | NINA-PRD-001 Addendum A (draft v0.1) |
| Date | 2026-10-13 |
| Status | Draft for founder review. Not merged into NINA-PRD-001. Requirement statuses updated 2026-10-18 after the overnight implementation run. |
| Source | Positioning brief (Financial Twin, neutral aggregation, deterministic engine, proactive insights, radical privacy) |
| Related | `docs/HISTORIAS_DE_USUARIO.md` (NINA-US-001), `CLAUDE.md` scope |

Priority key: **P0** = lean MVP, due 2026-10-31 · **P1** = November · **P2** = later (Phase 2/3).
Status key (as of the 2026-10-11 audit): Done · Partial · Not built.
Requirement IDs use the prefix `PRD-<pillar>-nn`. Cross-references to user stories use `US-nn` (NINA-US-001).

## 1. Problem & opportunity (delta)

Peruvians hold money across several banks, cards, wallets and cash, with little financial education and no neutral view of the whole. Banks sell products; wallets optimise for fast spending. Nina positions as the cognitive layer over the user's money: it organises, explains and recommends, and does not move money in Phase 1.

## 2. Positioning constraints (apply to every requirement below)

- Positioning: **Intelligence now, never moves money (for now).** The Agent and Wallet phases stay open and are not promised in copy.
- Segment: **B2C only** (Nina Personal). Nina Negocio / mypes are **deferred, not dropped**; no mype/SUNAT work until the founder decides after validating the personal MVP.
- Benchmarks: **Cleo** for voice, **Revolut AIR** for chat UX.
- Tone is in; behavioral tracking is out (no streaks, emotion tracking or relapse features). Roast the habit, never the person.
- Public copy: the story stays vision-level. The line "tus datos son tuyos" stays out of public copy until the audit confirms the real data flow.
- Nina Intelligence phase: understand → predict → recommend. No money movement.
- All figures come from `packages/finance-engine` via `NinaFinanceEngine`. The LLM never computes or invents numbers.
- Personal data is private by default; only rows assigned to a space are shared (RLS).
- Brand claims must be backed by implemented behaviour. Marketing copy may not promise a requirement still marked P1/P2.

## 3. Pillar 1 — Financial Twin

Goal: a dynamic 3–6 month projection of the user's money and instant what-if answers, with one direct recommendation.

| ID | Requirement | Prio | Status | Depends on |
|---|---|---|---|---|
| PRD-FT-01 | A single "available this month" figure from the engine, shown on Home and in chat. | P0 | Done (Home and chat read the one engine figure) | — |
| PRD-FT-02 | Engine produces a baseline projection for the next 3 months (6 optional) from `transactions`, recurring income and detected recurring expenses. Same inputs always give the same output. | P1 | Not built (US-31) | PRD-AGG-01, PRD-INS-02 |
| PRD-FT-03 | What-if via chat and a simulator screen: user states a one-off or recurring change (amount, month); the engine re-runs the projection and returns the delta in available money and the date a stated goal is reached or rebuilt. | P1 | Not built (US-32) | PRD-FT-02 |
| PRD-FT-04 | Each what-if answer returns one chart and one direct recommendation. The recommendation is chosen by deterministic rules; the LLM only phrases it. | P1 | Not built | PRD-FT-03 |
| PRD-FT-05 | Projection exposes a confidence band and the amount of history it used. With under 2 months of history the app says it cannot project yet and does not show a line. | P1 | Not built | PRD-FT-02 |
| PRD-FT-06 | Goals (e.g. emergency fund target) as inputs to what-if. | P2 | Not built (US-46/47) | PRD-FT-03 |

Acceptance criteria
- PRD-FT-02: *Given* 3+ months of transactions, *when* the projection runs twice on identical data, *then* both outputs are byte-identical and every month value is reproducible from `transactions` by a golden-dataset test.
- PRD-FT-03: *Given* a baseline and a what-if of S/ 1,500 in November, *when* the user asks in chat, *then* the response includes the engine-computed new available balance per month and the date of recovery, and no number in the text is absent from the engine payload (number validator passes).
- PRD-FT-04: *Given* a what-if result, *then* exactly one recommendation is returned and it is traceable to a named rule.
- PRD-FT-05: *Given* fewer than 2 months of data, *then* no projection is rendered and the user is told which data is missing.

## 4. Pillar 2 — Neutral, universal aggregation

Goal: banks, cards, savings and cash in one place, with no bank lock-in.

| ID | Requirement | Prio | Status | Depends on |
|---|---|---|---|---|
| PRD-AGG-01 | Manual entry of income and expenses, assignable to an account. | P0 | Done (US-06/07/26, US-41) | — |
| PRD-AGG-02 | Accounts of type bank, card, cash, savings, with per-account balance derived from `transactions`. | P0 | Done (Sprint E, US-41); migration in the new chain, not yet applied to production | — |
| PRD-AGG-03 | CSV import with column mapping, duplicate detection and a preview before commit. | P1 | Not built (stretch) | PRD-AGG-02 |
| PRD-AGG-04 | PDF statement import (Peruvian banks supported incrementally). | P1 | Not built (OUT this month) | PRD-AGG-03 |
| PRD-AGG-05 | Imported rows are marked with their source (manual / csv / pdf) and can be removed as a batch. | P1 | Not built | PRD-AGG-03 |
| PRD-AGG-06 | Bank-API / open-banking connections. | P2 | Not built | Regulatory review |

Acceptance criteria
- PRD-AGG-02: *Given* transactions on two accounts, *then* the sum of per-account balances equals the overall balance computed by the engine.
- PRD-AGG-03: *Given* a CSV containing rows already imported, *when* the user confirms, *then* duplicates are skipped and the user sees how many rows were added vs skipped.
- PRD-AGG-05: *Given* a bad import, *when* the user removes the batch, *then* only that batch is removed and all derived figures recompute.

## 5. Pillar 3 — Deterministic engine and auditability

Goal: zero invented numbers; every figure explainable.

| ID | Requirement | Prio | Status | Depends on |
|---|---|---|---|---|
| PRD-AUD-01 | One engine is the only producer of financial figures; no second computation path in app or services. | P0 | Done for every user-facing path: legacy `NinaFinanceEngine`, `/intelligence/snapshot`, `/home/intelligence` and the Dart metric code were removed (2026-10). Unreachable scaffolding in `src/ai/analytics` remains. | — |
| PRD-AUD-02 | Number validator on chat output: any figure in the reply must exist in the facts payload, else the reply is rejected and a safe fallback is sent. | P0 | Done: validator is fail-closed and covered by tests; unchanged by the voice work | PRD-AUD-01 |
| PRD-AUD-03 | "How I calculated this" button on every figure Nina states (Home, chat, what-if). Shows: formula in plain language, period, filters, number of transactions used, and a link to the transaction list that produced it. | P1 | Not built | PRD-AUD-01 |
| PRD-AUD-04 | Audit payload is produced by the engine alongside the figure (not re-derived by the client). | P1 | Not built | PRD-AUD-03 |
| PRD-AUD-05 | LLM receives only engine facts (`FactsPayload`), never raw transactions or balances; descriptions are treated as untrusted text. | P0 | Verified by code reading and tests (facts only, redacted question, untrusted fence). Live payload capture still pending (needs DEV + keys). | — |
| PRD-AUD-06 | Minimal audit view for the "available this month" figure only: plain-language formula, period, and number of transactions used, with a link to the list. Engine returns this alongside the figure. Subset of PRD-AUD-03/04. | P0 (proposed) | Done (2026-10): `audit` block on `/v1/overview` + "Cómo calculé esto" sheet on Home with link to Movimientos for the same period | PRD-FT-01 |

Acceptance criteria
- PRD-AUD-02: *Given* an LLM reply containing a figure not in the payload, *then* it is not shown and the logs contain no amounts or PII.
- PRD-AUD-03: *Given* any displayed figure, *when* the user taps the button, *then* the detail screen total equals the displayed figure to the cent, and the listed transactions sum to it.
- PRD-AUD-05: *Given* a transaction description containing an instruction, *then* the model's behaviour does not change (injection test passes).

Regulatory touchpoint: AI model risk and explainability. Any future score or credit-related output needs separate review.

## 6. Pillar 4 — Invisible proactive insights

Goal: silent deviation alerts and subscription detection, without notification spam.

| ID | Requirement | Prio | Status | Depends on |
|---|---|---|---|---|
| PRD-INS-01 | Category deviation: flag a category whose current-month spend, pace-adjusted, exceeds the trailing 3-month average by a configurable threshold. Requires 3 completed months. | P1 | Not built (US-29; `proactive-engine` exists behind flags) | PRD-AGG-01 |
| PRD-INS-02 | Subscription / recurring-charge detection from merchant + amount + cadence. User can confirm or dismiss a detection; dismissals persist. | P1 | Partial (service exists; not an MVP deliverable) | PRD-AGG-01 |
| PRD-INS-03 | Delivery is in-app only: a quiet "insights" surface on Home, no push. Max 1 new insight surfaced per day. | P1 | Not built | PRD-INS-01 |
| PRD-INS-04 | Push notifications with per-type opt-in, quiet hours and a hard cap per week. | P2 | Not built (US-45; OUT) | PRD-INS-03 |
| PRD-INS-05 | Each insight carries its audit payload (PRD-AUD-03) and a single suggested action. | P1 | Not built | PRD-AUD-04 |

Acceptance criteria
- PRD-INS-01: *Given* a category at 140% of its 3-month average at the same point in the month, *then* one insight is created once and is not re-created within the same month unless the deviation grows by a defined step.
- PRD-INS-02: *Given* a charge repeating monthly with a stable amount, *then* it is listed as a subscription with its next expected date; *when* dismissed, *then* it is not suggested again.
- PRD-INS-03: *Given* 5 qualifying insights in a day, *then* at most 1 is surfaced and the rest are held.

Constraint: "extra proactive triggers" stay behind feature flags until the founder lifts them.

## 7. Pillar 5 — Radical privacy

Goal: privacy as a visible product feature.

| ID | Requirement | Prio | Status | Depends on |
|---|---|---|---|---|
| PRD-PRV-01 | Explicit, revocable consent for data processing, AI use and analytics, with AI disabled when not granted. | P0 | Done (Sprint D, US-03/42); migration in the new chain | — |
| PRD-PRV-02 | RLS on every user-owned table; personal rows never visible to other members; verified by SQL tests for two users. | P0 | Done and tested on local DB (2026-10-18): `spaces_rls.sql` and `accounts_rls.sql` pass after migration `20260107` drops a legacy permissive INSERT policy. Production needs that migration. | — |
| PRD-PRV-03 | PII redaction before any LLM call; no amounts or PII in logs. | P0 | Partial: redaction now covers email, phone (+51), DNI, RUC, CCI and cards and is applied before embeddings; some legacy logs still print amounts or memory content (see audit) | — |
| PRD-PRV-04 | One-tap export of all user data (CSV/JSON). | P1 | Not built (US-43) | — |
| PRD-PRV-05 | One-tap account and data deletion, including storage objects, with a confirmation step and a completion receipt. | P1, **P0 candidate**; not to be marketed until legal review is confirmed by the founder | Not built (US-44) | — |
| PRD-PRV-06 | Published data policy: data is not used to train public models. | P1 | Open question | Provider terms review |

Acceptance criteria
- PRD-PRV-04: *Given* a user with data, *when* export is requested, *then* the file contains all their transactions, accounts, categories and consents, and nothing from other users or spaces they do not own.
- PRD-PRV-05: *Given* a confirmed deletion, *then* all rows with the user's id are removed or anonymised within the stated time, and a re-login fails.
- PRD-PRV-03: *Given* a chat turn, *then* the outbound prompt contains no email, phone, document number or raw description of a transaction.

Regulatory touchpoint: Peru's personal data protection law (Ley 29733) and its regulations. Legal review needed before PRD-PRV-06 is used in marketing.

## 7b. Pillar 6 — Shared spaces (couple / family)

Goal: several people see and categorize the expenses of a common fund (rent, groceries, utilities), separate from each member's private finances. This is a real requirement that the positioning brief did not cover.

| ID | Requirement | Prio | Status | Depends on |
|---|---|---|---|---|
| PRD-SPC-01 | Membership in `space_members`; RLS on shared rows checks membership via a `security definer` helper. | P0 | Done; RLS verified on local DB | — |
| PRD-SPC-02 | A personal transaction is never visible to other members; only rows assigned to a space are shared. | P0 | Done; verified by `spaces_rls.sql` on local DB | PRD-SPC-01 |
| PRD-SPC-03 | The space balance is computed by the engine, separately from the personal balance; what a member paid counts against their personal available. | P0 | Done (US-36, decision 11 Oct) | PRD-FT-01 |
| PRD-SPC-04 | Per-member contribution view and leaving a space. | P1 | Done (US-37/38) | PRD-SPC-01 |
| PRD-SPC-05 | Household *intelligence* (joint insights, joint forecast, joint what-if). | Out | Flagged OUT; see open question 5 | — |

Acceptance: *Given* users A and B in a space and A's personal transaction, *then* B cannot read it by API or direct Supabase query; *given* a space transaction, *then* both read it and totals match the engine.

## 8. Cross-cutting: voice and tone

| ID | Requirement | Prio | Status |
|---|---|---|---|
| PRD-VOX-01 | All user-facing copy follows the Nina voice guidelines: sassy and warm by default, no sass on debt or distress, never shame, one action per reply. | P0 | Done: voice, calm-mode and limits blocks are in `CHAT_SYSTEM_PROMPT_V1` |
| PRD-VOX-02 | A "calm mode" is triggered by deterministic keyword/intent rules and by a user toggle; it removes humour from the reply. | P1 | Partial: deterministic keyword rule done (debt, income loss, distress; no LLM detection). User toggle not built. |

Acceptance: *Given* a message about debt or distress, *then* the reply contains no joke or emoji and offers one concrete next step.

## 9. Non-functional requirements (delta)

- **Auditability:** every figure shown has a reproducible path to `transactions`.
- **Performance:** projection and what-if under 2 s p95 on 24 months of data. Open question: target to confirm.
- **Privacy:** no per-user state in process memory; confirmations are persisted.
- **Observability:** engine-vs-LLM mismatches and rejected replies are counted without storing amounts.

## 10. Risks & assumptions

- **Promise-vs-product gap:** the pitch names Financial Twin and audit button, which are P1. Mitigation: story and copy avoid dated feature claims until shipped.
- **Aggregation claim:** "all banks" is not true until import exists. Use "all your accounts, your way" for now.
- **Data volume:** deviation and projection need 3+ months of history; new users get no insights at first. Mitigation: empty states that say what is needed.
- **Legacy engine:** `src/intelligence/nina-finance.engine.ts` duplicates metrics; it must be retired before PRD-FT-02 is built.
- **Assumption:** a solo, part-time founder can deliver P1 items in November, in the order FT → AUD → INS → PRV.

## 11. Open questions

Decided 2026-10-13 unless noted.

1. **Minimal audit view:** proposed as P0 (PRD-AUD-06). Effort estimate to follow the code audit.
2. **Deletion (PRD-PRV-05):** kept as a P0 candidate; not marketed until the founder confirms legal review. Still open.
3. **LLM providers and training terms:** open. The code audit lists active providers; the founder verifies terms.
4. **In-app-only insights:** decided. Proactive triggers stay behind feature flags; push is a later phase.
5. **Shared spaces vs. "household intelligence OUT":** open. Spaces share data and balances (in); joint insights or forecasts are out. Confirm this is the intended boundary.
6. **Benchmark:** decided. Cleo for voice, Revolut AIR for chat UX.

## 12. Change log

- 2026-10-18: statuses updated for the overnight run. Built: PRD-AUD-06 (audit view), PRD-VOX-01 (voice in the chat prompt), PRD-VOX-02 (keyword calm mode, toggle pending), PII redaction before embeddings (PRD-PRV-03, partial). Retired: legacy engine path (PRD-AUD-01). Verified on a local database: RLS tests for spaces and accounts (PRD-PRV-02, PRD-SPC-01/02).
- Production note: the repo's migration chain is now a baseline of the production `public` schema plus re-based migrations for category rules, shared spaces, consents and accounts, and one security fix (see `docs/OVERNIGHT-LOG.md`). Nothing has been applied to production.
