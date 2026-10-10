import { endOfMonth, inPeriod, isoDate, startOfMonth } from './period'
import { isValidDate } from './timezone'
import type { EngineTransaction, MonthlyTotals } from './types'

/** Defense in depth: rows with an invalid date or amount never reach a calculation. */
export function usableTransactions(txs: EngineTransaction[]): EngineTransaction[] {
  return txs.filter((t) => isValidDate(t.postedAt) && Number.isFinite(t.amount))
}

export function signedFlows(txs: EngineTransaction[]): EngineTransaction[] {
  return usableTransactions(txs).filter((t) => !t.isTransfer)
}

export function monthlyTotals(
  txs: EngineTransaction[],
  year: number,
  month: number,
): MonthlyTotals {
  const from = startOfMonth(new Date(Date.UTC(year, month, 1)))
  const to = endOfMonth(from)
  const rows = signedFlows(txs).filter((t) => inPeriod(t.postedAt, from, to))
  const byCategory: Record<string, number> = {}
  let income = 0
  let expenses = 0
  for (const t of rows) {
    if (t.amount > 0) income += t.amount
    else {
      const spend = -t.amount
      expenses += spend
      byCategory[t.categorySlug] = (byCategory[t.categorySlug] ?? 0) + spend
    }
  }
  return { year, month, income, expenses, byCategory }
}

export function trailingFullMonths(
  txs: EngineTransaction[],
  asOf: Date,
  count: number,
): MonthlyTotals[] {
  const out: MonthlyTotals[] = []
  let y = asOf.getUTCFullYear()
  let m = asOf.getUTCMonth() - 1
  for (let i = 0; i < count; i++) {
    if (m < 0) {
      m += 12
      y -= 1
    }
    out.push(monthlyTotals(txs, y, m))
    m -= 1
  }
  return out.reverse()
}

export function monthToDateSpendByCategory(
  txs: EngineTransaction[],
  asOf: Date,
): Record<string, number> {
  const from = startOfMonth(asOf)
  const to = asOf
  const rows = signedFlows(txs).filter((t) => inPeriod(t.postedAt, from, to) && t.amount < 0)
  const byCategory: Record<string, number> = {}
  for (const t of rows) {
    byCategory[t.categorySlug] = (byCategory[t.categorySlug] ?? 0) + -t.amount
  }
  return byCategory
}

export function periodBounds(asOf: Date): { from: string; to: string } {
  return { from: isoDate(startOfMonth(asOf)), to: isoDate(asOf) }
}
