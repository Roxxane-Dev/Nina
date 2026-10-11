/**
 * Screen-level aggregates for Inicio, Movimientos and Análisis.
 * The app renders these numbers as-is; it never sums transactions itself.
 */
import { periodTotals, signedFlows } from './aggregates'
import { categoryLabel } from './categories'
import { isoDate } from './period'
import { monthLabelEs, monthRange, previousRange, type PeriodRange } from './periods'
import { ENGINE_VERSION } from './version'
import type { EngineTransaction } from './types'

export type Overview = {
  period: { from: string; to: string; label: string; granularity: PeriodRange['granularity'] }
  /** False when the user has never registered a movement (show onboarding, not zeros). */
  hasHistory: boolean
  txnCount: number
  income: number
  expenses: number
  /** income − expenses of the period. */
  available: number
  /** Historical balance: all incomes − all expenses registered (same as chat "saldo"). */
  balance: number
  categories: Array<{ slug: string; label: string; amount: number; sharePct: number }>
  previous: { label: string; income: number; expenses: number }
  /** expenses − previous.expenses */
  expensesChange: number
  engineVersion: string
}

export function buildOverview(txs: EngineTransaction[], range: PeriodRange, asOf: Date): Overview {
  const flows = signedFlows(txs)
  const current = periodTotals(flows, range.from, range.to)
  const prevRange = previousRange(range)
  const prev = periodTotals(flows, prevRange.from, prevRange.to)
  const firstDay = flows.reduce<Date | null>((min, t) => (!min || t.postedAt < min ? t.postedAt : min), null)
  const all = firstDay ? periodTotals(flows, firstDay, asOf) : { income: 0, expenses: 0 }

  const categories = Object.entries(current.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, amount]) => ({
      slug,
      label: categoryLabel(slug),
      amount: round(amount),
      sharePct: current.expenses > 0 ? Math.round((amount / current.expenses) * 100) : 0,
    }))

  return {
    period: { from: isoDate(range.from), to: isoDate(range.to), label: range.label, granularity: range.granularity },
    hasHistory: flows.length > 0,
    txnCount: current.count,
    income: round(current.income),
    expenses: round(current.expenses),
    available: round(current.income - current.expenses),
    balance: round(all.income - all.expenses),
    categories,
    previous: { label: prevRange.label, income: round(prev.income), expenses: round(prev.expenses) },
    expensesChange: round(current.expenses - prev.expenses),
    engineVersion: ENGINE_VERSION,
  }
}

export type TrendPoint = { year: number; month: number; label: string; income: number; expenses: number }

/** Last `months` calendar months (oldest first), current month to date included. */
export function monthlyTrend(txs: EngineTransaction[], asOf: Date, months = 6): TrendPoint[] {
  const flows = signedFlows(txs)
  const out: TrendPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1))
    const r = monthRange(d.getUTCFullYear(), d.getUTCMonth(), asOf)
    const t = periodTotals(flows, r.from, r.to)
    out.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      label: monthLabelEs(d.getUTCFullYear(), d.getUTCMonth()),
      income: round(t.income),
      expenses: round(t.expenses),
    })
  }
  return out
}

/**
 * API period parameter → range: 'current' (default), 'previous' or 'YYYY-MM'.
 * Returns null for anything else so the controller can answer 400.
 */
export function parsePeriodParam(param: string | undefined, asOf: Date): PeriodRange | null {
  const y = asOf.getUTCFullYear()
  const m = asOf.getUTCMonth()
  if (!param || param === 'current') return monthRange(y, m, asOf, true)
  if (param === 'previous') return m === 0 ? monthRange(y - 1, 11, asOf) : monthRange(y, m - 1, asOf)
  const match = /^(\d{4})-(\d{2})$/.exec(param)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return null
  if (year > y || (year === y && month > m)) return null // no future periods
  return monthRange(year, month, asOf)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export type MemberContribution = { userId: string; income: number; expenses: number; count: number }

/**
 * US-37: what each member registered in a shared space during the period.
 * `txs` are the space's rows; members with nothing registered still appear.
 */
export function memberContributions(
  txs: EngineTransaction[],
  range: PeriodRange,
  memberIds: string[],
): MemberContribution[] {
  const by = new Map<string, MemberContribution>(
    memberIds.map((id) => [id, { userId: id, income: 0, expenses: 0, count: 0 }]),
  )
  for (const t of signedFlows(txs)) {
    if (!t.authorId || t.postedAt < range.from || t.postedAt > range.to) continue
    const m = by.get(t.authorId) ?? { userId: t.authorId, income: 0, expenses: 0, count: 0 }
    if (t.amount > 0) m.income += t.amount
    else m.expenses += -t.amount
    m.count += 1
    by.set(t.authorId, m)
  }
  return [...by.values()]
    .map((m) => ({ ...m, income: round(m.income), expenses: round(m.expenses) }))
    .sort((a, b) => b.expenses - a.expenses)
}
