import { periodTotals, signedFlows } from './aggregates'
import { categoryLabel } from './categories'
import { isoDate } from './period'
import { monthLabelEs, monthRange, previousRange, type PeriodRange } from './periods'
import { ENGINE_VERSION } from './version'
import type {
  Confidence,
  DetectedRecurring,
  EngineTransaction,
  FactsIntent,
  FactsPayload,
  ForecastResult,
  HealthScoreResult,
  PeriodTotals,
} from './types'

export function buildFactsPayload(input: {
  intent: FactsIntent
  txs: EngineTransaction[]
  asOf: Date
  currency?: FactsPayload['currency']
  /** Range asked about (periods.ts); defaults to the current month, not explicit. */
  period?: PeriodRange
  /** Canonical category slug for 'category_spend'. */
  category?: string | null
  score?: HealthScoreResult
  forecast?: ForecastResult
  recurring?: DetectedRecurring[]
}): FactsPayload {
  const { intent, asOf } = input
  const txs = signedFlows(input.txs)
  const requested = input.period ?? monthRange(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf, false)

  // An empty *implicit* current month says nothing useful: use the latest month
  // with data and tell the user. A period the user named is respected as-is.
  let range = requested
  let requestedPeriodLabel: string | undefined
  if (!requested.explicit && periodTotals(txs, requested.from, requested.to).count === 0) {
    const latest = latestMonthWithData(txs)
    if (latest) {
      requestedPeriodLabel = requested.label
      range = monthRange(latest.year, latest.month, asOf)
    }
  }

  const prevRange = previousRange(range)
  const current = periodTotals(txs, range.from, range.to)
  const prev = periodTotals(txs, prevRange.from, prevRange.to)
  const inRange = txs.filter((t) => t.postedAt >= range.from && t.postedAt <= range.to)

  const figures: Record<string, number> = {
    income: round(current.income),
    expenses: round(current.expenses),
    available: round(current.income - current.expenses),
    txn_count: current.count,
    prev_income: round(prev.income),
    prev_expenses: round(prev.expenses),
    // Differences are computed here so the LLM never has to subtract.
    expenses_change: round(current.expenses - prev.expenses),
  }
  if (current.income > 0) {
    figures.savings_rate_pct = Math.round(((current.income - current.expenses) / current.income) * 100)
  }

  const items = categoryItems(current)
  const comparisons: NonNullable<FactsPayload['comparisons']> = [
    { label: `Gastos vs. ${prevRange.label}`, current: figures.expenses, baseline: figures.prev_expenses },
  ]

  let categoryLabelText: string | undefined
  if (intent === 'category_spend' && input.category) {
    categoryLabelText = categoryLabel(input.category)
    figures.category_spend = round(current.byCategory[input.category] ?? 0)
    figures.category_prev = round(prev.byCategory[input.category] ?? 0)
    figures.category_change = round(figures.category_spend - figures.category_prev)
    if (current.expenses > 0) {
      figures.category_share_pct = Math.round((figures.category_spend / current.expenses) * 100)
    }
    comparisons.push({
      label: `${categoryLabelText} vs. ${prevRange.label}`,
      current: figures.category_spend,
      baseline: figures.category_prev,
    })
  }

  if (intent === 'income') {
    const incomeItems = incomeByCategory(inRange)
    if (incomeItems.length) items.splice(0, items.length, ...incomeItems)
  }

  if (intent === 'score' && input.score) {
    figures.health_score = input.score.score
    for (const c of input.score.components) figures[`score_${c.key}`] = round(c.subScore)
  }
  if ((intent === 'forecast' || intent === 'available') && input.forecast) {
    figures.projected_end = input.forecast.projectedEndOfPeriod
    if (input.forecast.availableBeforeIncome != null) {
      figures.available_before_income = input.forecast.availableBeforeIncome
    }
  }
  if (intent === 'subscriptions' && input.recurring?.length) {
    figures.recurring_count = input.recurring.length
    figures.recurring_total = round(input.recurring.reduce((s, r) => s + r.typicalAmount, 0))
  }

  return {
    intent,
    period: { from: isoDate(range.from), to: isoDate(range.to) },
    currency: input.currency ?? 'PEN',
    figures,
    items,
    comparisons,
    txnCount: current.count,
    confidence: intent === 'forecast' && input.forecast ? input.forecast.confidence : dataConfidence(current.count),
    evidenceTxnIds: inRange.slice(0, 30).map((t) => t.id),
    engineVersion: ENGINE_VERSION,
    context: {
      periodLabel: range.label,
      requestedPeriodLabel,
      categoryLabel: categoryLabelText,
      hasHistory: txs.length > 0,
      granularity: range.granularity,
    },
  }
}

/**
 * "¿Cuál es mi saldo?" — there is no bank balance yet, so the balance is the
 * historical net of everything registered: all incomes − all expenses.
 */
export function buildBalanceFacts(input: { txs: EngineTransaction[]; asOf: Date }): FactsPayload {
  const txs = signedFlows(input.txs)
  const first = txs.reduce<Date | null>(
    (min, t) => (min == null || t.postedAt.getTime() < min.getTime() ? t.postedAt : min),
    null,
  )
  const from = first ?? input.asOf
  const all = periodTotals(txs, from, input.asOf)
  return {
    intent: 'balance',
    period: { from: isoDate(from), to: isoDate(input.asOf) },
    currency: 'PEN',
    figures: {
      balance: round(all.income - all.expenses),
      total_income: round(all.income),
      total_expenses: round(all.expenses),
      txn_count: all.count,
    },
    items: [],
    comparisons: [],
    txnCount: all.count,
    confidence: dataConfidence(all.count),
    evidenceTxnIds: txs.slice(0, 30).map((t) => t.id),
    engineVersion: ENGINE_VERSION,
    context: {
      periodLabel: first ? `desde ${monthLabelEs(first.getUTCFullYear(), first.getUTCMonth())}` : 'sin movimientos',
      hasHistory: txs.length > 0,
      granularity: 'all',
    },
  }
}

/** Latest expenses/incomes for the "recent" card. Shown to the user only, never sent to an LLM. */
export function recentTransactions(
  txs: EngineTransaction[],
  limit = 8,
): Array<{ id: string; date: string; category: string; amount: number; isIncome: boolean }> {
  return signedFlows(txs)
    .slice()
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      date: isoDate(t.postedAt),
      category: categoryLabel(t.categorySlug),
      amount: round(Math.abs(t.amount)),
      isIncome: t.amount > 0,
    }))
}

function dataConfidence(count: number): Confidence {
  if (count >= 15) return 'high'
  if (count >= 5) return 'medium'
  if (count > 0) return 'low'
  return 'insufficient'
}

function categoryItems(totals: PeriodTotals): Array<{ label: string; amount: number }> {
  return Object.entries(totals.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([slug, amount]) => ({ label: categoryLabel(slug), amount: round(amount) }))
}

function incomeByCategory(rows: EngineTransaction[]): Array<{ label: string; amount: number }> {
  const by: Record<string, number> = {}
  for (const t of rows) if (t.amount > 0) by[t.categorySlug] = (by[t.categorySlug] ?? 0) + t.amount
  return Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, amount]) => ({ label: categoryLabel(slug), amount: round(amount) }))
}

function latestMonthWithData(txs: EngineTransaction[]): { year: number; month: number } | null {
  if (!txs.length) return null
  const latest = txs.reduce((a, b) => (a.postedAt.getTime() >= b.postedAt.getTime() ? a : b))
  return { year: latest.postedAt.getUTCFullYear(), month: latest.postedAt.getUTCMonth() }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
