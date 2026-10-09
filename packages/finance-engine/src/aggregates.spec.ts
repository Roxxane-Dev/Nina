import { monthlyTotals } from './aggregates'
import type { EngineTransaction } from './types'

function tx(partial: Partial<EngineTransaction> & { postedAt: Date; amount: number }): EngineTransaction {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    postedAt: partial.postedAt,
    amount: partial.amount,
    currency: 'PEN',
    categorySlug: partial.categorySlug ?? 'food',
    merchantNormalized: partial.merchantNormalized ?? 'X',
    isTransfer: partial.isTransfer ?? false,
  }
}

describe('monthlyTotals', () => {
  it('excludes transfers and splits income vs expense', () => {
    const asOf = new Date(Date.UTC(2026, 8, 15))
    const rows = [
      tx({ postedAt: asOf, amount: 3000, categorySlug: 'salary' }),
      tx({ postedAt: asOf, amount: -200, categorySlug: 'food' }),
      tx({ postedAt: asOf, amount: -500, isTransfer: true }),
    ]
    const m = monthlyTotals(rows, 2026, 8)
    expect(m.income).toBe(3000)
    expect(m.expenses).toBe(200)
    expect(m.byCategory.food).toBe(200)
  })
})
