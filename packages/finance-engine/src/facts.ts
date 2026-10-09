import { monthlyTotals, periodBounds } from './aggregates'
import { ENGINE_VERSION } from './version'
import type {
  DetectedRecurring,
  EngineTransaction,
  FactsIntent,
  FactsPayload,
  ForecastResult,
  HealthScoreResult,
} from './types'

export function buildFactsPayload(input: {
  intent: FactsIntent
  txs: EngineTransaction[]
  asOf: Date
  currency?: FactsPayload['currency']
  score?: HealthScoreResult
  forecast?: ForecastResult
  recurring?: DetectedRecurring[]
}): FactsPayload {
  const { intent, txs, asOf } = input
  const period = periodBounds(asOf)
  const month = monthlyTotals(txs, asOf.getUTCFullYear(), asOf.getUTCMonth())
  const figures: Record<string, number> = {
    income: round(month.income),
    expenses: round(month.expenses),
    net: round(month.income - month.expenses),
    txn_count: txs.length,
  }
  const items = Object.entries(month.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, amount]) => ({ label, amount: round(amount) }))

  if (input.score) {
    figures.health_score = input.score.score
    for (const c of input.score.components) {
      figures[`score_${c.key}`] = round(c.subScore)
    }
  }
  if (input.forecast) {
    figures.projected_end = input.forecast.projectedEndOfPeriod
    figures.daily_discretionary = input.forecast.dailyDiscretionary
    if (input.forecast.availableBeforeIncome != null) {
      figures.available_before_income = input.forecast.availableBeforeIncome
    }
    if (input.forecast.incomeDate != null) figures.income_day = input.forecast.incomeDate
  }
  if (input.recurring?.length) {
    figures.recurring_count = input.recurring.length
    figures.recurring_total = round(input.recurring.reduce((s, r) => s + r.typicalAmount, 0))
  }

  const confidence = input.forecast?.confidence ?? (txs.length >= 20 ? 'high' : txs.length >= 8 ? 'medium' : 'insufficient')

  return {
    intent,
    period,
    currency: input.currency ?? 'PEN',
    figures,
    items,
    txnCount: txs.length,
    confidence,
    evidenceTxnIds: txs.slice(0, 30).map((t) => t.id),
    engineVersion: ENGINE_VERSION,
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
