import type { FactsPayload } from '../../packages/finance-engine/src'
import { extractNumbers, parseLocaleNumber, validateAnswer, type LlmAnswer } from './validator'

const facts: FactsPayload = {
  intent: 'spending_breakdown',
  period: { from: '2026-10-01', to: '2026-10-31' },
  currency: 'PEN',
  figures: { income: 4500, expenses: 1250.5, net: 3249.5, txn_count: 42 },
  items: [{ label: 'food', amount: 640.2 }],
  txnCount: 42,
  confidence: 'high',
  evidenceTxnIds: [],
  engineVersion: 'test',
}

const answer = (message: string): LlmAnswer => ({ message, figuresUsed: [], followUps: [] })

describe('parseLocaleNumber', () => {
  it.each([
    ['1,250.50', 1250.5],
    ['1.250,50', 1250.5],
    ['1,250', 1250],
    ['640.2', 640.2],
    ['38', 38],
    ['12,5', 12.5],
  ])('%s → %d', (raw, expected) => {
    expect(parseLocaleNumber(raw)).toBe(expected)
  })
})

describe('extractNumbers', () => {
  it('skips dates and years', () => {
    expect(extractNumbers('Al 15 de octubre de 2026 (15/10) gastaste S/ 1,250.50')).toEqual([1250.5])
  })
})

describe('validateAnswer', () => {
  it('accepts figures that come from FACTS, in Peruvian format', () => {
    expect(validateAnswer(answer('Este mes gastaste S/ 1,250.50, de los cuales S/ 640.20 fueron comida.'), facts).ok).toBe(true)
  })

  it('rejects an invented amount in the 32–2099 range (previously skipped)', () => {
    const v = validateAnswer(answer('Gastaste S/ 980 en comida.'), facts)
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('ungrounded_number:980')
  })

  it('rejects prohibited advice', () => {
    expect(validateAnswer(answer('Te garantizo que vas a ahorrar.'), facts).ok).toBe(false)
  })

  it('rejects projections when confidence is insufficient', () => {
    const low = { ...facts, confidence: 'insufficient' as const }
    expect(validateAnswer(answer('Terminarás el mes con S/ 3,249.50.'), low).ok).toBe(false)
  })
})
