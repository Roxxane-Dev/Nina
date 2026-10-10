import { monthlyTotals, monthToDateSpendByCategory, signedFlows } from './aggregates'
import { dayOfMonthCutoff } from './period'
import { mean, median, stdev } from './stats'
import { ENGINE_VERSION } from './version'
import type { AnomalyResult, EngineTransaction } from './types'

function monthToDateCategorySpend(
  txs: EngineTransaction[],
  year: number,
  month: number,
  asOf: Date,
  category: string,
): number {
  const cutoff = dayOfMonthCutoff(asOf, year, month)
  const from = new Date(Date.UTC(year, month, 1))
  return signedFlows(txs)
    .filter(
      (t) =>
        t.categorySlug === category &&
        t.amount < 0 &&
        t.postedAt >= from &&
        t.postedAt <= cutoff,
    )
    .reduce((s, t) => s + -t.amount, 0)
}

export function detectAnomalies(
  txs: EngineTransaction[],
  asOf: Date,
  opts?: { k?: number; monthlyIncome?: number },
): AnomalyResult {
  const k = Math.min(6, Math.max(3, opts?.k ?? 6))
  const S = opts?.monthlyIncome ?? 0
  const current = monthToDateSpendByCategory(txs, asOf)
  const spikes = []
  const categories = new Set<string>([
    ...Object.keys(current),
    ...txs.map((t) => t.categorySlug),
  ])

  for (const cat of categories) {
    const x = current[cat] ?? 0
    const history: number[] = []
    for (let i = 1; i <= k; i++) {
      let y = asOf.getUTCFullYear()
      let m = asOf.getUTCMonth() - i
      if (m < 0) {
        m += 12
        y -= 1
      }
      history.push(monthToDateCategorySpend(txs, y, m, asOf, cat))
    }
    if (history.length < 3) continue
    const mu = mean(history)
    const sd = Math.max(stdev(history), 0.1 * Math.abs(mu))
    if (sd === 0) continue
    const z = (x - mu) / sd
    const absDelta = x - mu
    const rel = mu === 0 ? (x > 0 ? 1 : 0) : absDelta / mu
    const moneyFloor = S > 0 ? S / 50 : 0
    if (z >= 2 && absDelta >= moneyFloor && rel >= 0.15) {
      const evidence = signedFlows(txs)
        .filter((t) => t.categorySlug === cat && t.amount < 0)
        .slice(0, 20)
        .map((t) => t.id)
      spikes.push({
        type: 'category_spike' as const,
        categorySlug: cat,
        current: x,
        mean: mu,
        z,
        impact: absDelta,
        evidenceTxnIds: evidence,
      })
    }
  }

  const unusual = []
  const groups = new Map<string, EngineTransaction[]>()
  for (const t of signedFlows(txs).filter((t) => t.amount < 0)) {
    const key = t.merchantNormalized || t.categorySlug
    const list = groups.get(key) ?? []
    list.push(t)
    groups.set(key, list)
  }
  for (const [, list] of groups) {
    if (list.length < 8) continue
    const amounts = list.map((t) => -t.amount)
    const m = median(amounts)
    const mad = median(amounts.map((a) => Math.abs(a - m)))
    if (mad === 0) continue
    for (const t of list) {
      const a = -t.amount
      const modifiedZ = (0.6745 * (a - m)) / mad
      const floor = S > 0 ? S / 80 : 0
      if (modifiedZ >= 3.5 && a >= floor) {
        unusual.push({
          type: 'unusual_txn' as const,
          transactionId: t.id,
          amount: a,
          modifiedZ,
          categorySlug: t.categorySlug,
          merchantNormalized: t.merchantNormalized,
        })
      }
    }
  }

  const trends = []
  for (const cat of categories) {
    const months: number[] = []
    for (let i = 5; i >= 0; i--) {
      let y = asOf.getUTCFullYear()
      let m = asOf.getUTCMonth() - i
      if (m < 0) {
        m += 12
        y -= 1
      }
      months.push(monthlyTotals(txs, y, m).byCategory[cat] ?? 0)
    }
    const last3 = months.slice(-3)
    const prev3 = months.slice(0, 3)
    const sequential =
      last3.length === 3 &&
      // A trend needs real spend: 0 ≥ 1.2 × 0 used to flag every idle category.
      last3[0] > 0 &&
      last3[1] >= 1.2 * last3[0] &&
      last3[2] >= 1.2 * last3[1]
    const avgLast = last3.reduce((s, x) => s + x, 0) / 3
    const avgPrev = prev3.reduce((s, x) => s + x, 0) / 3
    const avgTrend = avgPrev > 0 && avgLast >= 1.2 * avgPrev
    if (sequential || avgTrend) {
      trends.push({
        type: 'category_trend' as const,
        categorySlug: cat,
        monthlyTotals: last3,
      })
    }
  }

  return { spikes, unusual, trends, engineVersion: ENGINE_VERSION }
}
