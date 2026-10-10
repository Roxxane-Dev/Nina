import { ANA_TXS } from './__golden__/user-ana'
import { normalizeCategorySlug, detectCategoryInText } from './categories'
import { buildBalanceFacts, buildFactsPayload, recentTransactions } from './facts'
import { classifyIntent } from './intent'
import { monthRange, resolvePeriodRange } from './periods'
import { ENGINE_VERSION } from './version'

const OCT_9 = new Date(Date.UTC(2026, 9, 9))

describe('golden: user Ana', () => {
  it('pins August facts (explicit period)', () => {
    const f = buildFactsPayload({
      intent: 'spending_summary',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: monthRange(2026, 7, OCT_9),
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
    expect(f.context).toEqual({ periodLabel: 'agosto 2026', hasHistory: true, granularity: 'month' })
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
      period: monthRange(2026, 8, OCT_9),
    })
    expect(f.figures.expenses).toBe(0)
    expect(f.confidence).toBe('insufficient')
  })

  it('computes category spend with comparison', () => {
    const f = buildFactsPayload({
      intent: 'category_spend',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: monthRange(2026, 7, OCT_9),
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
      period: monthRange(2026, 7, OCT_9),
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
    ['dime cuanto he gastado en el año', 'spending_summary'],
    ['dime cuanto he gastado el ultimo mes', 'spending_summary'],
    ['¿cuál es mi saldo?', 'balance'],
    ['¿cuánto dinero tengo?', 'balance'],
    ['mi plata está rara', 'unknown_finance'],
  ])('%s → %s', (q, intent) => {
    expect(classifyIntent(q)).toBe(intent)
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
      period: monthRange(2026, 7, OCT_9),
    })
    expect(f.figures.income).toBe(5100)
    expect(() => buildFactsPayload({ intent: 'spending_summary', txs: [broken], asOf: OCT_9 })).not.toThrow()
  })
})

describe('golden: ranges (engine-v1.2.0)', () => {
  it('year to date: "dime cuanto he gastado en el año" (regression)', () => {
    const f = buildFactsPayload({
      intent: 'spending_summary',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: resolvePeriodRange('dime cuanto he gastado en el año', OCT_9),
    })
    expect(f.period).toEqual({ from: '2026-01-01', to: '2026-10-09' })
    expect(f.figures).toEqual(expect.objectContaining({ income: 9600, expenses: 3630.7, available: 5969.3, txn_count: 10, prev_expenses: 0 }))
    expect(f.context).toEqual(expect.objectContaining({ periodLabel: 'el año 2026', granularity: 'year' }))
    expect(f.context?.requestedPeriodLabel).toBeUndefined()
  })

  it('previous month: "el ultimo mes" respects an empty month (no fallback)', () => {
    const f = buildFactsPayload({
      intent: 'spending_summary',
      txs: ANA_TXS,
      asOf: OCT_9,
      period: resolvePeriodRange('dime cuanto he gastado el ultimo mes', OCT_9),
    })
    expect(f.context?.periodLabel).toBe('setiembre 2026')
    expect(f.figures.expenses).toBe(0)
    expect(f.figures.prev_expenses).toBe(1870.3)
    expect(f.confidence).toBe('insufficient')
  })

  it('this week compares against last week', () => {
    const aug7 = new Date(Date.UTC(2026, 7, 7))
    const f = buildFactsPayload({ intent: 'spending_summary', txs: ANA_TXS, asOf: aug7, period: resolvePeriodRange('esta semana', aug7) })
    expect(f.period).toEqual({ from: '2026-08-03', to: '2026-08-07' })
    expect(f.figures.expenses).toBe(1610.3)
    expect(f.figures.prev_expenses).toBe(0)
  })

  it('historical balance = all incomes − all expenses, transfers excluded', () => {
    const f = buildBalanceFacts({ txs: ANA_TXS, asOf: OCT_9 })
    expect(f.figures).toEqual({ balance: 5969.3, total_income: 9600, total_expenses: 3630.7, txn_count: 10 })
    expect(f.context).toEqual({ periodLabel: 'desde julio 2026', hasHistory: true, granularity: 'all' })
  })

  it('balance with no data', () => {
    const f = buildBalanceFacts({ txs: [], asOf: OCT_9 })
    expect(f.context?.hasHistory).toBe(false)
    expect(f.figures.balance).toBe(0)
  })
})
