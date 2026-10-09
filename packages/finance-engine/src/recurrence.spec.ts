import { detectRecurrence } from './recurrence'
import type { EngineTransaction } from './types'

describe('detectRecurrence', () => {
  it('detects a monthly merchant within ±10% amount', () => {
    const asOf = new Date(Date.UTC(2026, 8, 20))
    const txs: EngineTransaction[] = [5, 6, 7].map((m) => ({
      id: `n${m}`,
      postedAt: new Date(Date.UTC(2026, m, 8)),
      amount: m === 6 ? -36 : -35,
      currency: 'PEN',
      categorySlug: 'streaming',
      merchantNormalized: 'NETFLIX',
      isTransfer: false,
    }))
    const found = detectRecurrence(txs, asOf)
    expect(found.some((r) => r.merchantNormalized === 'NETFLIX' && r.frequency === 'monthly')).toBe(true)
  })
})
