import { parseExpenses, parseMoneyToken, normalizeCategory } from './expense-parser'

// ─── parseMoneyToken ──────────────────────────────────────────────────────────

describe('parseMoneyToken', () => {
  it('parses plain integers', () => {
    expect(parseMoneyToken('50')).toBe(50)
    expect(parseMoneyToken('1200')).toBe(1200)
  })

  it('parses Spanish thousands with dot', () => {
    expect(parseMoneyToken('1.200')).toBe(1200)
    expect(parseMoneyToken('12.345')).toBe(12345)
  })

  it('parses decimals with comma or dot', () => {
    expect(parseMoneyToken('25,50')).toBe(25.5)
    expect(parseMoneyToken('25.5')).toBe(25.5)
  })

  it('parses full Spanish money format', () => {
    expect(parseMoneyToken('1.234,56')).toBe(1234.56)
  })
})

// ─── normalizeCategory ────────────────────────────────────────────────────────

describe('normalizeCategory', () => {
  it('maps known Spanish words correctly', () => {
    expect(normalizeCategory('comida')).toBe('food')
    expect(normalizeCategory('ropa')).toBe('shopping')
    expect(normalizeCategory('netflix')).toBe('entertainment')
    expect(normalizeCategory('renta')).toBe('home')
    expect(normalizeCategory('uber')).toBe('transport')
  })

  it('returns "other" for unknown words', () => {
    expect(normalizeCategory('random')).toBe('other')
    expect(normalizeCategory('xyzabc')).toBe('other')
  })
})

// ─── parseExpenses ────────────────────────────────────────────────────────────

describe('parseExpenses', () => {
  it('extracts a single expense with category', () => {
    const r = parseExpenses('gasté 50 en comida')
    expect(r).toHaveLength(1)
    expect(r[0].amount).toBe(50)
    expect(r[0].normalizedCategory).toBe('food')
    expect(r[0].rawCategory).toBe('comida')
  })

  it('extracts compound expenses in order', () => {
    const r = parseExpenses('gasté 100 en comida, 30 en ropa y 60 en netflix')
    expect(r).toHaveLength(3)
    expect(r[0]).toMatchObject({ amount: 100, normalizedCategory: 'food' })
    expect(r[1]).toMatchObject({ amount: 30,  normalizedCategory: 'shopping' })
    expect(r[2]).toMatchObject({ amount: 60,  normalizedCategory: 'entertainment' })
  })

  it('handles "gasté X en A y gasté Y en B" pattern', () => {
    const r = parseExpenses('gasté 50 en ropa y gasté 30 en comida')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ amount: 50, normalizedCategory: 'shopping' })
    expect(r[1]).toMatchObject({ amount: 30, normalizedCategory: 'food' })
  })

  it('returns empty array for small talk (no intent)', () => {
    expect(parseExpenses('hola cómo estás')).toEqual([])
  })

  it('returns empty array for amount without expense intent', () => {
    expect(parseExpenses('el 30 de mayo')).toEqual([])
    expect(parseExpenses('50 pesos')).toEqual([])
  })

  it('classifies transport', () => {
    const r = parseExpenses('pagué 200 de uber')
    expect(r).toHaveLength(1)
    expect(r[0].normalizedCategory).toBe('transport')
    expect(r[0].amount).toBe(200)
  })

  it('falls back to "other" when category is unknown', () => {
    const r = parseExpenses('gasté 40 en cosasraras')
    expect(r).toHaveLength(1)
    expect(r[0].normalizedCategory).toBe('other')
  })
})
