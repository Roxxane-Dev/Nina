import { signedFlows } from './aggregates'
import { percentile } from './stats'
import { addMonths, daysBetween, endOfMonth, isoDate, startOfMonth } from './period'
import { ENGINE_VERSION } from './version'
import type {
  AccountAnchor,
  DetectedRecurring,
  EngineTransaction,
  ForecastResult,
} from './types'

function medianDayOfMonth(days: number[]): number {
  const s = [...days].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid]
}

export function computeForecast(
  txs: EngineTransaction[],
  asOf: Date,
  opts?: {
    anchors?: AccountAnchor[]
    recurring?: DetectedRecurring[]
    horizonEnd?: Date
  },
): ForecastResult {
  const horizon = opts?.horizonEnd ?? endOfMonth(asOf)
  const incomes = signedFlows(txs).filter((t) => t.amount > 0)
  const salaryDays = incomes
    .filter((t) => t.categorySlug === 'salary' || t.categorySlug === 'sueldo' || t.categorySlug === 'income')
    .map((t) => t.postedAt.getUTCDate())
  const allIncomeDays = salaryDays.length >= 3 ? salaryDays : incomes.map((t) => t.postedAt.getUTCDate())
  const incomeDate = allIncomeDays.length >= 2 ? medianDayOfMonth(allIncomeDays) : null
  const incomeRange =
    allIncomeDays.length >= 2
      ? Math.max(...allIncomeDays) - Math.min(...allIncomeDays)
      : null

  const from60 = new Date(asOf.getTime() - 60 * 86_400_000)
  const recMerchants = new Set((opts?.recurring ?? []).map((r) => r.merchantNormalized))
  const disc = signedFlows(txs).filter(
    (t) =>
      t.amount < 0 &&
      t.postedAt >= from60 &&
      t.postedAt <= asOf &&
      !recMerchants.has(t.merchantNormalized),
  )
  const dailyAmounts: number[] = []
  for (let d = 0; d < 60; d++) {
    const day = new Date(asOf.getTime() - d * 86_400_000)
    const spent = disc
      .filter((t) => isoDate(t.postedAt) === isoDate(day))
      .reduce((s, t) => s + -t.amount, 0)
    dailyAmounts.push(spent)
  }
  const dailyDiscretionary = percentile(dailyAmounts, 0.5)

  const monthsOfHistory = new Set(
    txs.map((t) => `${t.postedAt.getUTCFullYear()}-${t.postedAt.getUTCMonth()}`),
  ).size
  let confidence: ForecastResult['confidence'] = 'insufficient'
  if (monthsOfHistory >= 3 && (incomeRange ?? 99) <= 3) confidence = 'high'
  else if (monthsOfHistory >= 2) confidence = 'medium'

  const liquid = (opts?.anchors ?? []).reduce((s, a) => s + (a.anchorBalance ?? 0), 0)
  const hasAnchor = (opts?.anchors ?? []).some((a) => a.anchorBalance != null)
  const receivedThisCycle = incomes.some(
    (t) =>
      t.postedAt >= startOfMonth(asOf) &&
      t.postedAt <= asOf &&
      (incomeDate == null || Math.abs(t.postedAt.getUTCDate() - incomeDate) <= 3),
  )
  const expectedIncome = incomes.length
    ? incomes.slice(-3).reduce((s, t) => s + t.amount, 0) / Math.min(3, incomes.length)
    : 0

  const recurringDue = (opts?.recurring ?? [])
    .filter((r) => r.nextExpected >= asOf && r.nextExpected <= addMonths(horizon, 1))
    .map((r) => ({
      merchant: r.merchantNormalized,
      amount: r.typicalAmount,
      date: isoDate(r.nextExpected),
    }))

  const recUntilHorizon = recurringDue
    .filter((r) => r.date <= isoDate(horizon))
    .reduce((s, r) => s + r.amount, 0)

  const days = Math.max(0, daysBetween(asOf, horizon))
  const discSpend = dailyDiscretionary * days

  const willReceive = !receivedThisCycle && incomeDate != null && (
    asOf.getUTCDate() <= incomeDate || horizon >= new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), incomeDate))
  )

  const incomeTerm = willReceive ? expectedIncome : 0
  const projected = (hasAnchor ? liquid : 0) + incomeTerm - recUntilHorizon - discSpend

  const incomeDateObj = incomeDate
    ? new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), incomeDate))
    : null
  const recUntilIncome = incomeDateObj
    ? recurringDue.filter((r) => r.date <= isoDate(incomeDateObj)).reduce((s, r) => s + r.amount, 0)
    : 0

  const p25 = percentile(dailyAmounts, 0.25)
  const p75 = percentile(dailyAmounts, 0.75)

  return {
    kind: hasAnchor ? 'balance' : 'net_flow',
    projectedEndOfPeriod: roundish(projected),
    availableBeforeIncome: hasAnchor ? roundish(liquid - recUntilIncome) : null,
    incomeDate,
    incomeDateRangeDays: incomeRange,
    band: confidence === 'medium'
      ? {
          low: roundish((hasAnchor ? liquid : 0) + incomeTerm - recUntilHorizon - p75 * days),
          high: roundish((hasAnchor ? liquid : 0) + incomeTerm - recUntilHorizon - p25 * days),
        }
      : undefined,
    confidence,
    dailyDiscretionary: roundish(dailyDiscretionary),
    recurringDue,
    engineVersion: ENGINE_VERSION,
  }
}

function roundish(n: number): number {
  return Math.round(n * 100) / 100
}
