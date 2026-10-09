import { computeHealthScore } from './score'
import type { EngineTransaction } from './types'

function tx(y: number, m: number, d: number, amount: number, slug: string): EngineTransaction {
  return {
    id: `${y}-${m}-${d}-${amount}`,
    postedAt: new Date(Date.UTC(y, m, d)),
    amount,
    currency: 'PEN',
    categorySlug: slug,
    merchantNormalized: slug,
    isTransfer: false,
  }
}

describe('computeHealthScore', () => {
  it('returns 0–100 with five components and a label', () => {
    const asOf = new Date(Date.UTC(2026, 8, 20))
    const txs: EngineTransaction[] = []
    for (const month of [5, 6, 7]) {
      txs.push(tx(2026, month, 1, 4000, 'salary'))
      txs.push(tx(2026, month, 5, -800, 'food'))
      txs.push(tx(2026, month, 8, -400, 'transport'))
    }
    const result = computeHealthScore(txs, asOf, {
      anchors: [{
        accountId: 'a1',
        kind: 'checking',
        currency: 'PEN',
        anchorBalance: 6000,
        anchorDate: asOf,
      }],
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.components).toHaveLength(5)
    expect(result.label).toMatch(/Frágil|En construcción|Estable|Sólida/)
  })
})
