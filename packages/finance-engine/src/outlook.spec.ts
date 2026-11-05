import { ANA_TXS } from './__golden__/user-ana'
import { buildMonthOutlook, upcomingPayments } from './outlook'
import type { EngineTransaction } from './types'

const day = (d: string) => new Date(`${d}T00:00:00Z`)
let seq = 0
const tx = (date: string, amount: number, categorySlug: string, merchant = ''): EngineTransaction => ({
  id: `o${++seq}`,
  postedAt: day(date),
  amount,
  currency: 'PEN',
  categorySlug,
  merchantNormalized: merchant,
  isTransfer: false,
})

describe('buildMonthOutlook (golden: Ana)', () => {
  it('before payday: counts the usual monthly income and the typical daily spending', () => {
    expect(buildMonthOutlook(ANA_TXS, day('2026-09-02'))).toEqual({
      monthLabel: 'setiembre 2026',
      availableNow: 0,
      expectedIncome: 4800,
      incomeDay: 1,
      overdueIncome: 0,
      recurringUntilEnd: 0,
      dailySpend: 40.51,
      daysLeft: 28,
      discretionaryUntilEnd: 1134.33,
      projected: 3665.67,
      confidence: 'medium',
    })
  })

  it('payday long gone with nothing registered: the income is not counted, and it is reported', () => {
    const o = buildMonthOutlook(ANA_TXS, day('2026-09-10'))!
    expect(o.expectedIncome).toBe(0)
    expect(o.overdueIncome).toBe(4800)
    expect(o.projected).toBe(-653.4)
  })

  it('the parts always add up to the projection', () => {
    for (const d of ['2026-09-02', '2026-09-10', '2026-08-20']) {
      const o = buildMonthOutlook(ANA_TXS, day(d))!
      expect(o.projected).toBeCloseTo(o.availableNow + o.expectedIncome - o.recurringUntilEnd - o.discretionaryUntilEnd, 2)
    }
  })

  it('a short history does not project at all', () => {
    expect(buildMonthOutlook([tx('2026-09-01', 1000, 'salary')], day('2026-09-02'))).toBeNull()
    expect(buildMonthOutlook([], day('2026-09-02'))).toBeNull()
  })
})

describe('upcomingPayments', () => {
  const rent = (d: string) => tx(d, -1200, 'home', 'ALQUILER DEPA')
  const txs = [rent('2026-07-05'), rent('2026-08-05'), rent('2026-09-05')]

  it('lists fixed payments due in the next 30 days, with a readable name', () => {
    expect(upcomingPayments(txs, day('2026-09-20'))).toEqual([{ name: 'Alquiler Depa', amount: 1200, date: '2026-10-05' }])
  })

  it('nothing beyond the window, nothing without a pattern', () => {
    expect(upcomingPayments(txs, day('2026-09-20'), 10)).toEqual([])
    expect(upcomingPayments([rent('2026-09-05')], day('2026-09-20'))).toEqual([])
  })
})
