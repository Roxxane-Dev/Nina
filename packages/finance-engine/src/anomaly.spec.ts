import { detectAnomalies } from './anomaly'
import type { EngineTransaction } from './types'

function spend(id: string, year: number, month: number, day: number, amount: number, cat = 'transport'): EngineTransaction {
  return {
    id,
    postedAt: new Date(Date.UTC(year, month, day)),
    amount: -amount,
    currency: 'PEN',
    categorySlug: cat,
    merchantNormalized: 'TAXI',
    isTransfer: false,
  }
}

describe('detectAnomalies', () => {
  it('flags a category spike vs trailing months at same cutoff', () => {
    const asOf = new Date(Date.UTC(2026, 8, 20))
    const txs: EngineTransaction[] = []
    for (let m = 2; m <= 7; m++) {
      txs.push(spend(`h${m}`, 2026, m, 10, 100))
    }
    txs.push(spend('now', 2026, 8, 10, 400))
    const result = detectAnomalies(txs, asOf, { monthlyIncome: 5000, k: 6 })
    expect(result.spikes.some((s) => s.categorySlug === 'transport')).toBe(true)
    expect(result.engineVersion).toMatch(/^engine-v/)
  })
})

describe('detectAnomalies trends', () => {
  const asOf = new Date(Date.UTC(2026, 9, 9))

  it('does not report a trend for a category with no recent spend (regression)', () => {
    const txs = [spend('old', 2026, 4, 30, 50, 'food')]
    expect(detectAnomalies(txs, asOf).trends).toEqual([])
  })

  it('still reports a real sequential increase', () => {
    const txs = [
      spend('a', 2026, 7, 5, 100, 'food'),
      spend('b', 2026, 8, 5, 130, 'food'),
      spend('c', 2026, 9, 5, 170, 'food'),
    ]
    expect(detectAnomalies(txs, asOf).trends.map((t) => t.categorySlug)).toEqual(['food'])
  })
})
