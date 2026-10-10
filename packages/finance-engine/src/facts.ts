import { monthlyTotals, signedFlows } from './aggregates'
import { categoryLabel } from './categories'
import { monthLabelEs } from './intent'
import { endOfMonth, inPeriod, isoDate } from './period'
import { ENGINE_VERSION } from './version'
import type {
  Confidence,
  DetectedRecurring,
  EngineTransaction,
  FactsIntent,
  FactsPayload,
  ForecastResult,
  HealthScoreResult,
  MonthlyTotals,
} from './types'

type Month = { year: number; month: number }

export function buildFactsPayload(input: {
  intent: FactsIntent
  txs: EngineTransaction[]
  asOf: Date
  currency?: FactsPayload['currency']
  /** Month asked about; defaults to the month of `asOf`. */
  period?: Month & { explicit?: boolean }
  /** Canonical category slug for 'category_spend'. */
  category?: string | null
  score?: HealthScoreResult
  forecast?: ForecastResult
  recurring?: DetectedRecurring[]
}): FactsPayload {
  const { intent, asOf } = input
  const txs = signedFlows(input.txs)
  const requested: Month = input.period ?? { year: asOf.getUTCFullYear(), month: asOf.getUTCMonth() }

  // An empty current month says nothing useful: use the latest month with data
  // and tell the user. An explicitly requested month is respected as-is.
  let month = requested
  let requestedPeriodLabel: string | undefined
  if (!input.period?.explicit && countInMonth(txs, requested) === 0) {
    const latest = latestMonthWithData(txs)
    if (latest) {
      requestedPeriodLabel = monthLabelEs(requested.year, requested.month)
      month = latest
    }
  }

  const current = monthlyTotals(txs, month.year, month.month)
  const prevMonth = previous(month)
  const prev = monthlyTotals(txs, prevMonth.year, prevMonth.month)
  const inMonth = txsInMonth(txs, month)

  const figures: Record<string, number> = {
    income: round(current.income),
    expenses: round(current.expenses),
    available: round(current.income - current.expenses),
    txn_count: inMonth.length,
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
    { label: 'Gastos vs. mes anterior', current: figures.expenses, baseline: figures.prev_expenses },
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
      label: `${categoryLabelText} vs. mes anterior`,
      current: figures.category_spend,
      baseline: figures.category_prev,
    })
  }

  if (intent === 'income') {
    const incomeItems = incomeByCategory(inMonth)
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

  const lastDay = endOfMonth(new Date(Date.UTC(month.year, month.month, 1)))
  return {
    intent,
    period: {
      from: isoDate(new Date(Date.UTC(month.year, month.month, 1))),
      to: isoDate(lastDay.getTime() < asOf.getTime() ? lastDay : asOf),
    },
    currency: input.currency ?? 'PEN',
    figures,
    items,
    comparisons,
    txnCount: inMonth.length,
    confidence: intent === 'forecast' && input.forecast ? input.forecast.confidence : dataConfidence(inMonth.length),
    evidenceTxnIds: inMonth.slice(0, 30).map((t) => t.id),
    engineVersion: ENGINE_VERSION,
    context: {
      periodLabel: monthLabelEs(month.year, month.month),
      requestedPeriodLabel,
      categoryLabel: categoryLabelText,
      hasHistory: txs.length > 0,
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

function categoryItems(totals: MonthlyTotals): Array<{ label: string; amount: number }> {
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

function txsInMonth(txs: EngineTransaction[], m: Month): EngineTransaction[] {
  const from = new Date(Date.UTC(m.year, m.month, 1))
  const to = endOfMonth(from)
  return txs.filter((t) => inPeriod(t.postedAt, from, to))
}

function countInMonth(txs: EngineTransaction[], m: Month): number {
  return txsInMonth(txs, m).length
}

function latestMonthWithData(txs: EngineTransaction[]): Month | null {
  if (!txs.length) return null
  const latest = txs.reduce((a, b) => (a.postedAt.getTime() >= b.postedAt.getTime() ? a : b))
  return { year: latest.postedAt.getUTCFullYear(), month: latest.postedAt.getUTCMonth() }
}

function previous(m: Month): Month {
  return m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
