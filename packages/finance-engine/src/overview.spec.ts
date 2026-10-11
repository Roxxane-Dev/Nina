import { ANA_TXS } from './__golden__/user-ana'
import { buildOverview, memberContributions, monthlyTrend, parsePeriodParam } from './overview'
import { monthRange } from './periods'

const OCT_9 = new Date(Date.UTC(2026, 9, 9))

describe('golden: overview (user Ana)', () => {
  it('pins August', () => {
    const o = buildOverview(ANA_TXS, monthRange(2026, 7, OCT_9), OCT_9)
    expect(o).toEqual({
      period: { from: '2026-08-01', to: '2026-08-31', label: 'agosto 2026', granularity: 'month' },
      hasHistory: true,
      txnCount: 5,
      income: 5100,
      expenses: 1870.3,
      available: 3229.7,
      balance: 5969.3,
      categories: [
        { slug: 'home', label: 'Hogar', amount: 1200, sharePct: 64 },
        { slug: 'food', label: 'Comida', amount: 410.3, sharePct: 22 },
        { slug: 'transport', label: 'Transporte', amount: 260, sharePct: 14 },
      ],
      previous: { label: 'julio 2026', income: 4500, expenses: 1760.4 },
      expensesChange: 109.9,
      engineVersion: expect.any(String),
    })
  })

  it('an empty current month still carries the historical balance', () => {
    const o = buildOverview(ANA_TXS, monthRange(2026, 9, OCT_9), OCT_9)
    expect(o.txnCount).toBe(0)
    expect(o.expenses).toBe(0)
    expect(o.balance).toBe(5969.3)
    expect(o.hasHistory).toBe(true)
  })

  it('a new user has no history', () => {
    const o = buildOverview([], monthRange(2026, 9, OCT_9), OCT_9)
    expect(o.hasHistory).toBe(false)
    expect(o.categories).toEqual([])
  })
})

describe('monthlyTrend', () => {
  it('returns the last 6 months, oldest first', () => {
    const t = monthlyTrend(ANA_TXS, OCT_9, 6)
    expect(t.map((p) => p.label)).toEqual(['mayo 2026', 'junio 2026', 'julio 2026', 'agosto 2026', 'setiembre 2026', 'octubre 2026'])
    expect(t[2]).toEqual({ year: 2026, month: 6, label: 'julio 2026', income: 4500, expenses: 1760.4 })
    expect(t[3].expenses).toBe(1870.3)
  })

  it('crosses the year boundary', () => {
    const t = monthlyTrend([], new Date(Date.UTC(2027, 0, 15)), 3)
    expect(t.map((p) => p.label)).toEqual(['noviembre 2026', 'diciembre 2026', 'enero 2027'])
  })
})

describe('parsePeriodParam', () => {
  it.each([
    [undefined, '2026-10-01'],
    ['current', '2026-10-01'],
    ['previous', '2026-09-01'],
    ['2026-07', '2026-07-01'],
  ])('%p → starts %s', (param, from) => {
    expect(parsePeriodParam(param, OCT_9)?.from.toISOString().slice(0, 10)).toBe(from)
  })

  it.each(['2026-13', '2026-11', 'abc', '2026-7'])('rejects %p', (param) => {
    expect(parsePeriodParam(param, OCT_9)).toBeNull()
  })
})

describe('memberContributions (US-37)', () => {
  const tx = (id: string, author: string, amount: number, day: number) => ({
    id,
    postedAt: new Date(Date.UTC(2026, 9, day)),
    amount,
    currency: 'PEN' as const,
    categorySlug: 'home',
    merchantNormalized: 'X',
    isTransfer: false,
    authorId: author,
    sharedSpaceId: 'casa',
  })

  it('splits the space by who registered each movement', () => {
    const rows = [tx('1', 'ana', -1200, 1), tx('2', 'beto', -300.5, 3), tx('3', 'beto', 500, 4), tx('4', 'ana', -50, 20)]
    const range = monthRange(2026, 9, new Date(Date.UTC(2026, 9, 10)))
    expect(memberContributions(rows, range, ['ana', 'beto', 'carla'])).toEqual([
      { userId: 'ana', income: 0, expenses: 1200, count: 1 },
      { userId: 'beto', income: 500, expenses: 300.5, count: 2 },
      { userId: 'carla', income: 0, expenses: 0, count: 0 },
    ])
  })
})
