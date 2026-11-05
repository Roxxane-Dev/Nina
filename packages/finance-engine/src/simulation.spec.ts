import { ANA_TXS } from './__golden__/user-ana'
import { buildGoalPlanFacts } from './goal-plan'
import type { MonthOutlook } from './outlook'
import { savingsPace, simulatePurchase } from './simulation'

const outlook: MonthOutlook = {
  monthLabel: 'noviembre 2026',
  availableNow: 1200,
  expectedIncome: 3000,
  incomeDay: 15,
  overdueIncome: 0,
  recurringUntilEnd: 900,
  dailySpend: 50,
  daysLeft: 20,
  discretionaryUntilEnd: 1000,
  projected: 2300,
  confidence: 'high',
}

describe('simulatePurchase (INS-06)', () => {
  it('cash: the whole cost leaves this month', () => {
    expect(simulatePurchase(outlook, { cost: 800 }, 400)).toEqual({
      cost: 800,
      installments: 0,
      thisMonth: 800,
      monthlyPayment: 800,
      projectedBefore: 2300,
      projectedAfter: 1500,
      verdict: 'fits',
      monthsOfSavings: 2,
    })
  })

  it('installments: only one leaves this month, interest not included', () => {
    const s = simulatePurchase(outlook, { cost: 3000, installments: 6 }, 400)
    expect(s.thisMonth).toBe(500)
    expect(s.projectedAfter).toBe(1800)
    expect(s.monthsOfSavings).toBe(7.5)
  })

  it('tight when less than a week of typical spending is left, compromises when it goes negative', () => {
    expect(simulatePurchase(outlook, { cost: 2000 }, 400).verdict).toBe('tight') // 300 left < 350
    expect(simulatePurchase(outlook, { cost: 2400 }, 400).verdict).toBe('compromises')
  })

  it('without a positive savings pace there is no "months of savings"', () => {
    expect(simulatePurchase(outlook, { cost: 800 }, null).monthsOfSavings).toBeNull()
    expect(simulatePurchase(outlook, { cost: 800 }, -100).monthsOfSavings).toBeNull()
  })
})

describe('savingsPace is the one the goal plans use', () => {
  it('matches the goal plan figures on the golden dataset', () => {
    const asOf = new Date('2026-09-15T00:00:00Z')
    const pace = savingsPace(ANA_TXS, asOf)!
    const facts = buildGoalPlanFacts({ txs: ANA_TXS, asOf, goal: { amount: 1000, currency: 'PEN', name: 'X', deadline: null, deadlinePast: false } })
    expect(Math.round(pace.pace * 100) / 100).toBe(facts.figures.avg_monthly_savings)
    expect(pace.months).toBe(facts.figures.months_used)
  })
})
