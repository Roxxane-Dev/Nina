import type { FactsPayload } from '../../packages/finance-engine/src'
import { DISTRESS_HELPLINE } from '../chat/calm-mode'
import { buildGroundedUserPrompt, CHAT_SYSTEM_PROMPT_V1 } from './chat-prompt'
import { templatedAnswer } from './validator'

const facts = {
  intent: 'available',
  period: { from: '2026-10-01', to: '2026-10-31' },
  currency: 'PEN',
  figures: {
    income: 4500,
    expenses: 120.5,
    available: 4379.5,
    txn_count: 2,
    balance: 5749.5,
    total_income: 6000,
    total_expenses: 250.5,
  },
  items: [{ label: 'Comida', amount: 120.5 }],
  txnCount: 2,
  confidence: 'high',
  evidenceTxnIds: ['a', 'b'],
  context: { periodLabel: 'octubre 2026', granularity: 'month', hasHistory: true },
  engineVersion: 'test',
} as unknown as FactsPayload

describe('CHAT_SYSTEM_PROMPT_V1', () => {
  it('keeps the figures rule: only FACTS numbers, never compute or invent', () => {
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('Usa SOLO las cifras que aparecen en FACTS')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('Nunca calcules, estimes')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('Nunca uses "$"')
  })

  it('has the Nina voice, calm mode and limits', () => {
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('VOZ')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('Tutea siempre')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('Máximo 1 emoji')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('MODO CALMA')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('cero humor, cero emojis')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('No eres un banco')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('no prometes resultados')
  })

  it('tells the model to give the crisis resource on hopelessness or self-harm, even without keywords', () => {
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('desesperanza o ideas de hacerse daño')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('aunque no use ninguna palabra clave')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain(DISTRESS_HELPLINE) // same constant as the fixed reply
  })

  it('keeps the injection defence and the JSON contract', () => {
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('<untrusted>')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('Devuelve SOLO JSON')
    for (const key of ['message', 'figures_used', 'recommendation', 'follow_ups', 'confidence_note']) {
      expect(CHAT_SYSTEM_PROMPT_V1).toContain(`"${key}"`)
    }
  })
})

describe('buildGroundedUserPrompt', () => {
  it('sends engine facts without transaction ids, and the fenced question', () => {
    const p = buildGroundedUserPrompt(facts, '<untrusted>hola</untrusted>')
    expect(p).toContain('"available":4379.5')
    expect(p).not.toContain('evidenceTxnIds')
    expect(p).not.toContain('calm_mode')
    expect(p).toContain('<untrusted>hola</untrusted>')
  })

  it('adds calm_mode only when asked', () => {
    expect(buildGroundedUserPrompt(facts, 'q', { calm: true })).toContain('"calm_mode":true')
  })
})

describe('templatedAnswer fallbacks still work (fail-closed path untouched)', () => {
  it.each([
    ['available', 'te quedan S/ 4,379.50'],
    ['spending_summary', 'gastaste S/ 120.50'],
    ['income', 'suman S/ 4,500.00'],
  ])('%s', (intent, expected) => {
    const msg = templatedAnswer({ ...facts, intent } as unknown as FactsPayload).message
    expect(msg).toContain(expected)
    expect(/\p{Extended_Pictographic}/u.test(msg)).toBe(false)
  })

  it('balance and empty history', () => {
    expect(templatedAnswer({ ...facts, intent: 'balance' } as unknown as FactsPayload).message).toContain('S/ 5,749.50')
    const empty = templatedAnswer({
      ...facts,
      context: { ...(facts as unknown as { context: object }).context, hasHistory: false },
    } as unknown as FactsPayload).message
    expect(empty).toContain('Aún no tienes movimientos')
  })
})

describe('templatedAnswer period wording', () => {
  const withPeriod = (periodLabel: string, granularity: string) =>
    ({ ...facts, intent: 'spending_summary', context: { periodLabel, granularity, hasHistory: true } }) as unknown as FactsPayload

  it.each([
    ['ayer', 'day', 'Ayer gastaste'],
    ['hoy', 'day', 'Hoy gastaste'],
    ['esta semana', 'week', 'Esta semana gastaste'],
    ['octubre 2026', 'month', 'En octubre 2026 gastaste'],
    ['el año 2026', 'year', 'En el año 2026 gastaste'],
  ])('%s (%s) reads "%s"', (label, granularity, expected) => {
    expect(templatedAnswer(withPeriod(label, granularity)).message).toContain(expected)
  })
})
