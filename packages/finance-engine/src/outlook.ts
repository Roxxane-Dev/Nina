/**
 * INS-01 / INS-03: where the month is heading, said with its assumptions. Everything comes from
 * computeForecast (the only projection in the engine); this module adds what the user already has
 * this month and lays the parts out so "Cómo lo calculé" can show them.
 */
import { periodTotals, signedFlows } from './aggregates'
import { computeForecast } from './forecast'
import { isoDate } from './period'
import { monthLabelEs, monthRange } from './periods'
import { detectRecurrence } from './recurrence'
import type { Confidence, EngineTransaction } from './types'

export type UpcomingPayment = { name: string; amount: number; date: string }

export type MonthOutlook = {
  monthLabel: string
  /** income − expenses − set aside, month to date: the same figure as Inicio. */
  availableNow: number
  /** Income that usually arrives and has not arrived yet this month; 0 if it already did. */
  expectedIncome: number
  incomeDay: number | null
  /** The usual income has not been registered and its day passed: not counted in `projected`. */
  overdueIncome: number
  recurringUntilEnd: number
  /** Typical daily spending outside fixed payments: the mean over the last 60 days with history. */
  dailySpend: number
  daysLeft: number
  discretionaryUntilEnd: number
  /** availableNow + expectedIncome − recurringUntilEnd − discretionaryUntilEnd */
  projected: number
  confidence: Exclude<Confidence, 'insufficient'>
}

export const UPCOMING_DAYS = 30
const MIN_RECURRING_CONFIDENCE = 0.5
const round = (n: number) => Math.round(n * 100) / 100
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase())

/** Fixed payments the history says are coming, soonest first. */
export function upcomingPayments(txs: EngineTransaction[], asOf: Date, days = UPCOMING_DAYS): UpcomingPayment[] {
  const until = new Date(asOf.getTime() + days * 86_400_000)
  return detectRecurrence(txs, asOf)
    .filter((r) => r.confidence >= MIN_RECURRING_CONFIDENCE && r.nextExpected >= asOf && r.nextExpected <= until)
    .sort((a, b) => a.nextExpected.getTime() - b.nextExpected.getTime())
    .map((r) => ({ name: titleCase(r.merchantNormalized), amount: round(r.typicalAmount), date: isoDate(r.nextExpected) }))
}

/** Null when the history is too short to project honestly. */
export function buildMonthOutlook(txs: EngineTransaction[], asOf: Date): MonthOutlook | null {
  if (!signedFlows(txs).length) return null
  const forecast = computeForecast(txs, asOf, { recurring: detectRecurrence(txs, asOf) })
  if (forecast.confidence === 'insufficient' || forecast.kind !== 'net_flow') return null
  const range = monthRange(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf, true)
  const now = periodTotals(txs, range.from, range.to)
  const availableNow = round(now.income - now.expenses - now.setAside)
  return {
    monthLabel: monthLabelEs(asOf.getUTCFullYear(), asOf.getUTCMonth()),
    availableNow,
    expectedIncome: forecast.parts.expectedIncome,
    incomeDay: forecast.incomeDate,
    overdueIncome: forecast.parts.overdueIncome,
    recurringUntilEnd: forecast.parts.recurringUntilEnd,
    dailySpend: forecast.dailyDiscretionary,
    daysLeft: forecast.parts.daysLeft,
    discretionaryUntilEnd: forecast.parts.discretionaryUntilEnd,
    projected: round(availableNow + forecast.projectedEndOfPeriod),
    confidence: forecast.confidence,
  }
}
