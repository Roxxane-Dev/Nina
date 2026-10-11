import { matchCategoryRule, normalizeRulePattern } from './categories'

describe('category rules (US-24)', () => {
  it('normalizes descriptions into stable patterns', () => {
    expect(normalizeRulePattern('  Almuerzo   en TAMBO #23! ')).toBe('almuerzo en tambo')
    expect(normalizeRulePattern('Café')).toBe('cafe')
    expect(normalizeRulePattern('12')).toBe('')
    expect(normalizeRulePattern(null)).toBe('')
  })

  const rules = [
    { pattern: 'tambo', category: 'shopping' },
    { pattern: 'almuerzo en tambo', category: 'food' },
    { pattern: 'uber', category: 'transport' },
  ]

  it('applies the most specific matching rule', () => {
    expect(matchCategoryRule('Almuerzo en Tambo', rules)).toBe('food')
    expect(matchCategoryRule('tambo', rules)).toBe('shopping')
    expect(matchCategoryRule('Uber al trabajo', rules)).toBe('transport')
  })

  it('matches whole words only', () => {
    expect(matchCategoryRule('tambores', rules)).toBeNull()
    expect(matchCategoryRule('cine', rules)).toBeNull()
  })
})
