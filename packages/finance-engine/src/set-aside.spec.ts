import { buildOverview } from './overview'
import { buildGoalPlanFacts } from './goal-plan'
import { setAsideByGoal } from './aggregates'
import { monthRange } from './periods'
import type { EngineTransaction } from './types'

const tx = (date: string, amount: number, categorySlug: string, extra: Partial<EngineTransaction> = {}): EngineTransaction => ({
  id: `${date}-${categorySlug}-${amount}`,
  postedAt: new Date(`${date}T00:00:00Z`),
  amount,
  currency: 'PEN',
  categorySlug,
  merchantNormalized: '',
  isTransfer: false,
  ...extra,
})

const asOf = new Date('2026-10-27T00:00:00Z')
const txs = [
  tx('2026-10-01', 4000, 'salary'),
  tx('2026-10-05', -1000, 'housing'),
  tx('2026-10-10', -200, 'savings', { goalId: 'goal-japon' }),
]

describe('HOME-02: money set aside for a goal', () => {
  it('is not spending, but it comes out of the available figure', () => {
    const o = buildOverview(txs, monthRange(2026, 9, asOf, true), asOf)
    expect(o.expenses).toBe(1000)
    expect(o.setAside).toBe(200)
    expect(o.available).toBe(2800)
    expect(o.categories.map((c) => c.slug)).toEqual(['housing'])
    expect(o.audit.available).toBe(2800)
    expect(o.audit.formula).toContain('lo apartado para tus metas')
    expect(o.audit.evidenceTxnIds).toHaveLength(3)
  })

  it('without contributions the formula stays as before', () => {
    const o = buildOverview(txs.slice(0, 2), monthRange(2026, 9, asOf, true), asOf)
    expect(o.setAside).toBe(0)
    expect(o.available).toBe(3000)
    expect(o.audit.formula).not.toContain('apartado')
  })

  it('negative only because of money set aside is flagged; real overspending is not', () => {
    const range = monthRange(2026, 9, asOf, true)
    const saved = buildOverview([tx('2026-10-10', -250, 'savings', { goalId: 'g' })], range, asOf)
    expect(saved.available).toBe(-250)
    expect(saved.negativeFromSetAside).toBe(true)

    const overspent = buildOverview(
      [tx('2026-10-01', 1000, 'salary'), tx('2026-10-02', -1200, 'home'), tx('2026-10-03', -100, 'savings', { goalId: 'g' })],
      range,
      asOf,
    )
    expect(overspent.available).toBe(-300)
    expect(overspent.negativeFromSetAside).toBe(false)
  })

  it('does not lower the savings pace used by goal plans', () => {
    const months = ['2026-07', '2026-08', '2026-09'].flatMap((m) => [
      tx(`${m}-01`, 3000, 'salary'),
      tx(`${m}-03`, -1000, 'housing'),
      tx(`${m}-04`, -500, 'savings', { goalId: 'goal-japon' }),
    ])
    const facts = buildGoalPlanFacts({ txs: months, asOf, goal: { amount: 6000, currency: 'PEN' } as never })
    expect(facts.figures.avg_expenses).toBe(1000)
    expect(facts.figures.avg_monthly_savings).toBe(2000)
  })
})

describe('HOME-04: money withdrawn from a goal', () => {
  const range = monthRange(2026, 9, asOf, true)
  const goal = { goalId: 'goal-japon' }

  it('returns to the available figure and is never income', () => {
    const o = buildOverview(
      [tx('2026-10-01', 4000, 'salary'), tx('2026-10-05', -1000, 'home'), tx('2026-10-10', 300, 'savings', goal)],
      range,
      asOf,
    )
    expect(o.income).toBe(4000)
    expect(o.expenses).toBe(1000)
    expect(o.setAside).toBe(-300)
    expect(o.available).toBe(3300)
    expect(o.audit.formula).toContain('+ lo que retiraste de tus metas')
  })

  it('nets against contributions and lowers goal progress', () => {
    const txs = [tx('2026-09-10', -500, 'savings', goal), tx('2026-10-10', 200, 'savings', goal)]
    expect(setAsideByGoal(txs)).toEqual({ 'goal-japon': 300 })
  })

  it('does not raise the income the savings pace is built on', () => {
    const months = ['2026-07', '2026-08', '2026-09'].flatMap((m) => [
      tx(m + '-01', 3000, 'salary'),
      tx(m + '-03', -1000, 'home'),
      tx(m + '-04', 900, 'savings', goal),
    ])
    const facts = buildGoalPlanFacts({ txs: months, asOf, goal: { amount: 6000, currency: 'PEN' } as never })
    expect(facts.figures.avg_income).toBe(3000)
    expect(facts.figures.avg_monthly_savings).toBe(2000)
  })
})
