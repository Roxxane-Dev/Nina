import { ANA_TXS } from './__golden__/user-ana'
import { normalizeCategorySlug, detectCategoryInText } from './categories'
import { buildFactsPayload, recentTransactions } from './facts'
import { classifyIntent, resolvePeriod } from './intent'
import { ENGINE_VERSION } from './version'

const OCT_9 = new Date(Date.UTC(2026, 9, 9))

describe('golden: user Ana', () => {
  it('pins August facts (explicit period)', () => {
    const f = buildFactsPayload({
      intent: 'spending_summary',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: { year: 2026, month: 7, explicit: true },
    })
    expect(f.engineVersion).toBe(ENGINE_VERSION)
    expect(f.figures).toEqual({
      income: 5100,
      expenses: 1870.3,
      available: 3229.7,
      txn_count: 5,
      prev_income: 4500,
      prev_expenses: 1760.4,
      expenses_change: 109.9,
      savings_rate_pct: 63,
    })
    expect(f.items).toEqual([
      { label: 'Hogar', amount: 1200 },
      { label: 'Comida', amount: 410.3 },
      { label: 'Transporte', amount: 260 },
    ])
    expect(f.context).toEqual({ periodLabel: 'agosto 2026', hasHistory: true })
    expect(f.confidence).toBe('medium')
  })

  it('falls back to the latest month with data when the current month is empty', () => {
    const f = buildFactsPayload({ intent: 'spending_summary', txs: ANA_TXS, asOf: OCT_9 })
    expect(f.context?.periodLabel).toBe('agosto 2026')
    expect(f.context?.requestedPeriodLabel).toBe('octubre 2026')
    expect(f.figures.expenses).toBe(1870.3)
  })

  it('respects an explicitly requested empty month', () => {
    const f = buildFactsPayload({
      intent: 'spending_summary',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: { year: 2026, month: 8, explicit: true },
    })
    expect(f.figures.expenses).toBe(0)
    expect(f.confidence).toBe('insufficient')
  })

  it('computes category spend with comparison', () => {
    const f = buildFactsPayload({
      intent: 'category_spend',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: { year: 2026, month: 7, explicit: true },
      category: 'food',
    })
    expect(f.figures.category_spend).toBe(410.3)
    expect(f.figures.category_prev).toBe(350.5)
    expect(f.figures.category_share_pct).toBe(22)
    expect(f.figures.category_change).toBe(59.8)
    expect(f.context?.categoryLabel).toBe('Comida')
  })

  it('breaks down income by source', () => {
    const f = buildFactsPayload({
      intent: 'income',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: { year: 2026, month: 7, explicit: true },
    })
    expect(f.items).toEqual([
      { label: 'Sueldo', amount: 4500 },
      { label: 'Ingresos extra', amount: 600 },
    ])
  })

  it('a user with no data has no history', () => {
    const f = buildFactsPayload({ intent: 'spending_summary', txs: [], asOf: OCT_9 })
    expect(f.context?.hasHistory).toBe(false)
    expect(f.figures.expenses).toBe(0)
  })

  it('lists recent movements newest first, excluding transfers', () => {
    const r = recentTransactions(ANA_TXS, 3)
    expect(r.map((x) => x.date)).toEqual(['2026-08-22', '2026-08-15', '2026-08-06'])
    expect(r[0]).toEqual(expect.objectContaining({ category: 'Ingresos extra', amount: 600, isIncome: true }))
  })
})

describe('classifyIntent', () => {
  it.each([
    ['¿En qué gasto más?', 'spending_breakdown'],
    ['¿cuánto gasté este mes?', 'spending_summary'],
    ['dime mis gastos', 'spending_summary'],
    ['¿cuánto gasté en comida?', 'category_spend'],
    ['cuánto llevo en taxis', 'category_spend'],
    ['¿cuáles son mis ingresos?', 'income'],
    ['¿cuánto me queda?', 'available'],
    ['muéstrame mis últimos gastos', 'recent'],
    ['¿qué puedes hacer?', 'help'],
    ['hola', 'help'],
    ['¿cómo voy?', 'score'],
    ['¿qué pasa si compro un celular en cuotas?', 'whatif'],
    ['cuéntame un chiste', 'other'],
  ])('%s → %s', (q, intent) => {
    expect(classifyIntent(q)).toBe(intent)
  })
})

describe('resolvePeriod', () => {
  it('defaults to the current month', () => {
    expect(resolvePeriod('¿cuánto gasté?', OCT_9)).toEqual({ year: 2026, month: 9, explicit: false })
  })
  it('understands "el mes pasado"', () => {
    expect(resolvePeriod('¿y el mes pasado?', OCT_9)).toEqual({ year: 2026, month: 8, explicit: true })
  })
  it('understands a month name, never in the future', () => {
    expect(resolvePeriod('gastos de julio', OCT_9)).toEqual({ year: 2026, month: 6, explicit: true })
    expect(resolvePeriod('gastos de diciembre', OCT_9)).toEqual({ year: 2025, month: 11, explicit: true })
  })
})

describe('categories', () => {
  it('merges Spanish names and slugs', () => {
    expect(normalizeCategorySlug('comida')).toBe('food')
    expect(normalizeCategorySlug('Food')).toBe('food')
    expect(normalizeCategorySlug('Sueldo')).toBe('salary')
    expect(normalizeCategorySlug('???')).toBe('other')
  })
  it('detects a category in a question', () => {
    expect(detectCategoryInText('¿cuánto gasté en Uber?')).toBe('transport')
    expect(detectCategoryInText('¿cuánto gasté?')).toBeNull()
  })
})

describe('invalid dates (regression: RangeError Invalid time value)', () => {
  it('rows with an invalid date are ignored instead of breaking the facts', () => {
    const broken = { ...ANA_TXS[0], id: 'bad', postedAt: new Date('x') }
    const f = buildFactsPayload({
      intent: 'spending_summary',
      txs: [...ANA_TXS, broken],
      asOf: OCT_9,
      period: { year: 2026, month: 7, explicit: true },
    })
    expect(f.figures.income).toBe(5100)
    expect(() => buildFactsPayload({ intent: 'spending_summary', txs: [broken], asOf: OCT_9 })).not.toThrow()
  })
})
