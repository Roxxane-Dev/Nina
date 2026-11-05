import { isGoalWithdrawal, isSetAside, signedFlows, trailingFullMonths } from './aggregates'
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
  const incomes = signedFlows(txs).filter((t) => t.amount > 0 && !isGoalWithdrawal(t))
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
      !isSetAside(t) &&
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
  // Most days have nothing registered, so a median would say "S/ 0 a day". The mean over the
  // days actually covered by the history is the typical pace.
  const firstDay = signedFlows(txs).reduce<Date | null>((min, t) => (!min || t.postedAt < min ? t.postedAt : min), null)
  const coveredDays = firstDay ? Math.min(60, Math.max(1, daysBetween(firstDay, asOf) + 1)) : 60
  const dailyDiscretionary = dailyAmounts.slice(0, coveredDays).reduce((s, n) => s + n, 0) / coveredDays

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
  // A month's income, not the average of the last three deposits (a side job would drag it down).
  const incomeMonths = trailingFullMonths(txs, asOf, 3).filter((m) => m.income > 0)
  const expectedIncome = incomeMonths.length ? incomeMonths.reduce((s, m) => s + m.income, 0) / incomeMonths.length : 0

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

  // Income is expected only up to a few days past its usual day; later than that it is overdue
  // (probably not registered yet) and the projection says so instead of counting on it.
  const INCOME_GRACE_DAYS = 3
  const incomeOverdue = !receivedThisCycle && incomeDate != null && asOf.getUTCDate() > incomeDate + INCOME_GRACE_DAYS
  const willReceive = !receivedThisCycle && incomeDate != null && !incomeOverdue

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
    parts: {
      expectedIncome: roundish(incomeTerm),
      recurringUntilEnd: roundish(recUntilHorizon),
      discretionaryUntilEnd: roundish(discSpend),
      daysLeft: days,
      incomeOverdue,
      overdueIncome: incomeOverdue ? roundish(expectedIncome) : 0,
    },
    engineVersion: ENGINE_VERSION,
  }
}

function roundish(n: number): number {
  return Math.round(n * 100) / 100
}
