import { buildFactsPayload, localToday, resolveQuestion } from '../../packages/finance-engine/src'
import { toEngineTransactions } from '../finance-engine/map-transactions'
import { CALM_PREFIX, CALM_REPLIES, detectCalmTopic, stripEmoji } from './calm-mode'
import { GeneralHandler } from './intents/general.handler'
import type { ChatContext } from './intents/handler'
import { QueryResponder } from './intents/query-responder'

const EMOJI = /\p{Extended_Pictographic}/u
const ASOF = localToday(new Date('2026-10-09T17:00:00Z'))

describe('detectCalmTopic (deterministic keywords, PRD-VOX-02)', () => {
  it.each([
    ['tengo muchas deudas y no sé qué hacer', 'debt'],
    ['me llaman de cobranza todos los días', 'debt'],
    ['estoy endeudado con la tarjeta', 'debt'],
    ['ya no puedo pagar mi préstamo', 'debt'],
    ['estoy en mora', 'debt'],
    ['me despidieron ayer', 'income_loss'],
    ['Perdí mi trabajo', 'income_loss'],
    ['estoy sin empleo', 'income_loss'],
    ['me bajaron el sueldo', 'income_loss'],
    ['ya no puedo más', 'distress'],
    ['estoy desesperada', 'distress'],
    ['tengo mucha ansiedad por la plata', 'distress'],
    ['ME QUIERO MORIR', 'distress'],
  ])('%s → %s', (message, kind) => {
    expect(detectCalmTopic(message)).toBe(kind)
  })

  it('distress wins over debt when both appear', () => {
    expect(detectCalmTopic('tengo deudas y ya no puedo más')).toBe('distress')
  })

  it.each([
    'gasté 25 en taxi',
    '¿cuánto gasté este mes?',
    'sin embargo gasté poco',
    'debo comprar pan',
    'cuál es mi saldo',
    'mi moral está bien',
    'me pagaron el sueldo',
  ])('does not trigger on "%s"', (message) => {
    expect(detectCalmTopic(message)).toBeNull()
  })
})

describe('calm replies', () => {
  it('have no emoji, no exclamations and a next step', () => {
    for (const r of Object.values(CALM_REPLIES)) {
      expect(EMOJI.test(r.reply)).toBe(false)
      expect(r.reply).not.toContain('!')
      expect(r.followUps.length).toBeGreaterThan(0)
    }
    expect(EMOJI.test(CALM_PREFIX)).toBe(false)
  })

  it('stripEmoji removes pictographs only', () => {
    expect(stripEmoji('Listo 💡 gastaste S/ 25.50 ✅')).toBe('Listo gastaste S/ 25.50')
  })
})

describe('calm mode in the chat handlers', () => {
  const { txs } = toEngineTransactions([
    { id: 'a', type: 'income', amount: 4500, category: 'salary', description: 'sueldo', date: '2026-10-01T00:00:00+00:00' },
    { id: 'b', type: 'expense', amount: 120.5, category: 'food', description: 'super', date: '2026-10-03T00:00:00+00:00' },
  ])
  const explainFacts = jest.fn()
  const responder = new QueryResponder({ explainFacts } as never)

  function ctx(message: string, calm: ChatContext['calm']): ChatContext {
    return { userId: 'u1', message, asOf: ASOF, question: resolveQuestion(message, ASOF), aiAllowed: true, calm }
  }
  const facts = (message: string) => {
    const q = resolveQuestion(message, ASOF)
    return buildFactsPayload({ intent: q.intent, txs, asOf: ASOF, period: q.period, category: q.category })
  }

  beforeEach(() => explainFacts.mockReset())

  it('a data question in calm mode never reaches the LLM and has no emoji', async () => {
    const message = 'tengo deudas, ¿cuánto me queda este mes?'
    const res = await responder.explain(ctx(message, 'debt'), facts(message))
    expect(explainFacts).not.toHaveBeenCalled()
    expect(res.llmUsed).toBe(false)
    expect(res.reply.reply.startsWith(CALM_PREFIX)).toBe(true)
    expect(res.reply.reply).toContain('S/ 4,379.50')
    expect(EMOJI.test(res.reply.reply)).toBe(false)
  })

  it('without calm mode the LLM path is used as before', async () => {
    const message = '¿cuánto me queda este mes?'
    explainFacts.mockResolvedValue({
      answer: { message: 'Te quedan S/ 4,379.50.', figuresUsed: [], followUps: [] },
      validationPassed: true,
      usedLlm: true,
    })
    const res = await responder.explain(ctx(message, null), facts(message))
    expect(explainFacts).toHaveBeenCalledTimes(1)
    expect(res.llmUsed).toBe(true)
  })

  it('general handler answers calm topics with the fixed reply', async () => {
    const general = new GeneralHandler()
    for (const kind of ['debt', 'income_loss', 'distress'] as const) {
      const res = await general.handle(ctx('me despidieron', kind))
      expect(res.reply.reply).toBe(CALM_REPLIES[kind].reply)
      expect(res.llmUsed).toBeUndefined()
    }
  })

  it('general handler is unchanged outside calm mode', async () => {
    const res = await new GeneralHandler().handle(ctx('cuéntame un chiste', null))
    expect(Object.values(CALM_REPLIES).map((r) => r.reply)).not.toContain(res.reply.reply)
    expect(res.outcome).toBe('unrecognized')
  })
})
