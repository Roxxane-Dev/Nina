import { ANA_TXS } from './__golden__/user-ana'
import { buildGoalPlanFacts, extractGoalName, parseGoalRequest } from './goal-plan'
import { classifyIntent } from './intent'

const OCT_24 = new Date(Date.UTC(2026, 9, 24))

describe('parseGoalRequest', () => {
  it('reads the Japan message: dollars, year-only deadline, trip name', () => {
    const g = parseGoalRequest(
      'dime quiero viajar a japon en 2028 y quiero ahorrar una bolsita de 6000 dolares cual seria mi plan pra llegar a ese ahorro meta',
      OCT_24,
    )
    expect(g).toEqual({ amount: 6000, currency: 'USD', name: 'Viaje a japon', deadline: { year: 2028, month: 11 }, deadlinePast: false })
  })

  it('reads soles with month + year, and never takes the month as the name', () => {
    const g = parseGoalRequest('como alcanzo mi meta de 6000 soles para enero 2028', OCT_24)
    expect(g).toMatchObject({ amount: 6000, currency: 'PEN', name: 'Mi meta', deadline: { year: 2028, month: 0 } })
  })

  it.each([
    ['quiero ahorrar 2000 para un viaje', { amount: 2000, name: 'viaje', deadline: null }],
    ['meta de 6,000 soles en 6 meses', { amount: 6000, deadline: { year: 2027, month: 3 } }],
    ['quiero juntar 6 mil para una laptop', { amount: 6000, name: 'laptop' }],
    ['ahorrar $1500 para diciembre', { amount: 1500, currency: 'USD', deadline: { year: 2026, month: 11 } }],
    ['quiero ahorrar 3000 en 2 años', { amount: 3000, deadline: { year: 2028, month: 9 } }],
  ])('%s', (msg, expected) => {
    expect(parseGoalRequest(msg, OCT_24)).toMatchObject(expected)
  })

  it('flags a deadline that is already over instead of inventing one', () => {
    const g = parseGoalRequest('quiero ahorrar 1000 para enero 2026', OCT_24)
    expect(g).toMatchObject({ deadline: null, deadlinePast: true })
  })

  it('returns null without an amount, and ignores years and durations as amounts', () => {
    expect(parseGoalRequest('como alcanzo mi meta', OCT_24)).toBeNull()
    expect(parseGoalRequest('quiero ahorrar en 2028 durante 6 meses', OCT_24)).toBeNull()
  })

  it('extractGoalName falls back to a neutral name', () => {
    expect(extractGoalName('mi meta de 500')).toBe('Mi meta')
  })
})

describe('classifyIntent: goal_plan vs goal', () => {
  it.each([
    'como alcanzo mi meta de 6000 soles para enero 2028',
    'cual seria mi plan para llegar a ese ahorro',
    '¿cuánto tengo que ahorrar al mes para 5000 soles?',
    'en cuánto tiempo llego a juntar 3000',
  ])('plan: %s', (m) => expect(classifyIntent(m)).toBe('goal_plan'))

  it.each(['quiero ahorrar 2000 para un viaje', 'mis metas', 'cómo puedo ahorrar'])('not a plan: %s', (m) =>
    expect(classifyIntent(m)).not.toBe('goal_plan'),
  )
})

describe('buildGoalPlanFacts (golden: Ana)', () => {
  const goal = parseGoalRequest('quiero ahorrar 6000 soles para marzo 2027', OCT_24)!

  it('computes the per-month plan and the real savings pace', () => {
    const f = buildGoalPlanFacts({ txs: ANA_TXS, asOf: OCT_24, goal })
    expect(f.intent).toBe('goal_plan')
    expect(f.figures.target).toBe(6000)
    expect(f.figures.months_left).toBe(5)
    expect(f.figures.required_per_month).toBe(1200)
    expect(f.figures.avg_monthly_savings).toBeGreaterThan(0)
    expect(f.figures.gap_per_month).toBeCloseTo(1200 - f.figures.avg_monthly_savings, 2)
    expect(f.context?.goalDeadlineLabel).toBe('marzo 2027')
  })

  it('converts dollars with the stated rate and exposes it', () => {
    const usd = parseGoalRequest('ahorrar 1000 dolares para marzo 2027', OCT_24)!
    const f = buildGoalPlanFacts({ txs: ANA_TXS, asOf: OCT_24, goal: usd, usdPenRate: 3.8 })
    expect(f.figures).toMatchObject({ target: 3800, target_usd: 1000, usd_pen_rate: 3.8 })
  })

  it('without history gives the required amount but invents no savings pace', () => {
    const f = buildGoalPlanFacts({ txs: [], asOf: OCT_24, goal })
    expect(f.figures.required_per_month).toBe(1200)
    expect(f.figures.avg_monthly_savings).toBeUndefined()
    expect(f.figures.gap_per_month).toBeUndefined()
    expect(f.context?.hasHistory).toBe(false)
    expect(f.confidence).toBe('insufficient')
  })

  it('without a deadline there is no per-month figure', () => {
    const f = buildGoalPlanFacts({ txs: ANA_TXS, asOf: OCT_24, goal: parseGoalRequest('ahorrar 6000 soles', OCT_24)! })
    expect(f.figures.required_per_month).toBeUndefined()
    expect(f.figures.months_at_current_pace).toBeGreaterThan(0)
  })
})
