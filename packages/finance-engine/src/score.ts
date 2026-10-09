import { trailingFullMonths } from './aggregates'
import { clamp, mean, stdev } from './stats'
import { isoDate, startOfMonth } from './period'
import { ENGINE_VERSION } from './version'
import {
  DEFAULT_SCORE_WEIGHTS,
  type AccountAnchor,
  type EngineTransaction,
  type HealthScoreResult,
  type RecurringItemInput,
  type ScoreWeights,
} from './types'

const DISCRETIONARY = new Set([
  'food',
  'comida',
  'transport',
  'transporte',
  'entertainment',
  'entretenimiento',
  'shopping',
  'cafe',
  'café',
  'snacks',
  'delivery',
])

function linearBand(ratio: number, good: number, bad: number): number {
  if (ratio <= good) return 100
  if (ratio >= bad) return 0
  return 100 * ((bad - ratio) / (bad - good))
}

function labelFor(score: number): HealthScoreResult['label'] {
  if (score <= 39) return 'Frágil'
  if (score <= 59) return 'En construcción'
  if (score <= 79) return 'Estable'
  return 'Sólida'
}

export function computeHealthScore(
  txs: EngineTransaction[],
  asOf: Date,
  opts?: {
    anchors?: AccountAnchor[]
    recurring?: RecurringItemInput[]
    weights?: ScoreWeights
  },
): HealthScoreResult {
  const weights = opts?.weights ?? DEFAULT_SCORE_WEIGHTS
  const months = trailingFullMonths(txs, asOf, 3)
  const income = mean(months.map((m) => m.income))
  const expenses = mean(months.map((m) => m.expenses))
  const evidence = txs.slice(0, 40).map((t) => t.id)

  const savingsRate = income > 0 ? (income - expenses) / income : 0
  const savingsSub = clamp(savingsRate / 0.2, 0, 1) * 100

  const liquid = (opts?.anchors ?? [])
    .filter((a) => a.kind === 'checking' || a.kind === 'savings' || a.kind === 'cash' || a.kind === 'wallet')
    .reduce((s, a) => s + (a.anchorBalance ?? 0), 0)
  const monthsCovered = expenses > 0 ? liquid / expenses : 0
  const liquiditySub = clamp(monthsCovered / 3, 0, 1) * 100

  const debtPay = txs
    .filter((t) => !t.isTransfer && t.amount < 0 && (t.categorySlug === 'debt' || t.categorySlug === 'loan' || t.categorySlug === 'deuda'))
    .reduce((s, t) => s + -t.amount, 0) / Math.max(1, months.length || 1)
  const debtRatio = income > 0 ? debtPay / income : 0
  const debtSub = linearBand(debtRatio, 0.1, 0.4)

  const discMonths = months.map((m) =>
    Object.entries(m.byCategory)
      .filter(([slug]) => DISCRETIONARY.has(slug))
      .reduce((s, [, v]) => s + v, 0),
  )
  const discMean = mean(discMonths)
  const cv = discMean > 0 ? stdev(discMonths) / discMean : 0
  const stabilitySub = clamp(1 - cv / 0.5, 0, 1) * 100

  const recMonthly = (opts?.recurring ?? []).reduce((s, r) => {
    const factor =
      r.frequency === 'weekly' ? 4.33 :
      r.frequency === 'biweekly' ? 2.17 :
      r.frequency === 'annual' ? 1 / 12 : 1
    return s + r.typicalAmount * factor
  }, 0)
  const recRatio = income > 0 ? recMonthly / income : 0
  const commitmentsSub = linearBand(recRatio, 0.3, 0.7)

  const components: HealthScoreResult['components'] = [
    {
      key: 'savings_rate',
      label: 'Tasa de ahorro',
      weight: weights.savingsRate,
      subScore: savingsSub,
      inputs: { income, expenses, savingsRate },
      evidenceTxnIds: evidence,
    },
    {
      key: 'liquidity_buffer',
      label: 'Colchón de liquidez',
      weight: weights.liquidityBuffer,
      subScore: liquiditySub,
      inputs: { liquid, expenses, monthsCovered },
      evidenceTxnIds: evidence,
    },
    {
      key: 'debt_load',
      label: 'Carga de deuda',
      weight: weights.debtLoad,
      subScore: debtSub,
      inputs: { debtPay, income, debtRatio },
      evidenceTxnIds: evidence,
    },
    {
      key: 'spending_stability',
      label: 'Estabilidad de gasto',
      weight: weights.spendingStability,
      subScore: stabilitySub,
      inputs: { cv, discMean },
      evidenceTxnIds: evidence,
    },
    {
      key: 'commitments',
      label: 'Compromisos',
      weight: weights.commitments,
      subScore: commitmentsSub,
      inputs: { recMonthly, income, recRatio },
      evidenceTxnIds: evidence,
    },
  ]

  const score = Math.round(
    components.reduce((s, c) => s + c.weight * c.subScore, 0),
  )

  const from = months[0]
    ? `${fromYearMonth(months[0].year, months[0].month)}`
    : isoDate(startOfMonth(asOf))
  const to = isoDate(asOf)

  return {
    score: clamp(score, 0, 100),
    label: labelFor(score),
    components,
    engineVersion: ENGINE_VERSION,
    periodFrom: from,
    periodTo: to,
  }
}

function fromYearMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}
