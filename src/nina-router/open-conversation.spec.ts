/**
 * CI-01: open conversation through the LLM, without figures.
 * - The validator rejects any number, currency, percent or number word.
 * - The router sends only the redacted, untrusted message (no facts, no memory).
 * - GeneralHandler uses it only with AI consent and outside calm mode, and falls
 *   back to the deterministic reply when there is no validated answer.
 */
import { resolveQuestion } from '../../packages/finance-engine/src'
import { MOCK_UNAVAILABLE_REPLY } from '../ai/providers/mock.provider'
import { CALM_REPLIES } from '../chat/calm-mode'
import { GeneralHandler, OUT_OF_SCOPE_REPLY, UNRECOGNIZED_REPLY } from '../chat/intents/general.handler'
import type { ChatContext } from '../chat/intents/handler'
import { CHAT_OPEN_PROMPT_V1 } from './chat-prompt'
import { NinaRouterService } from './nina-router.service'
import { cleanFollowUps, validateOpenAnswer } from './open-validator'

const ASOF = new Date(Date.UTC(2026, 9, 27))
const ok = (message: string, followUps: string[] = []) => validateOpenAnswer({ message, followUps })

describe('validateOpenAnswer', () => {
  it('accepts plain education without figures', () => {
    expect(ok('El interés es lo extra que pagas cuando te prestan plata. Piensa en ello como un alquiler por usar dinero ajeno.').ok).toBe(true)
    expect(ok('Una tarjeta de crédito te deja pagar después.', ['¿Cuánto me queda este mes?']).ok).toBe(true)
  })

  it.each([
    ['digit', 'Ahorra 200 al mes'],
    ['digit', 'En 2027 vas a estar mejor'],
    ['currency', 'Guarda unos S/ cada semana'],
    ['currency', 'Eso cuesta US$ mucho'],
    ['currency', 'como un $ extra'],
    ['percent', 'Separa el veinte % de tu sueldo'],
    ['percent', 'el diez por ciento'],
    ['number_word', 'Junta mil soles'],
    ['number_word', 'unos cien soles'],
    ['number_word', 'un millón de razones'],
    ['number_word', 'unas lucas'],
  ])('rejects %s: %s', (reason, message) => {
    expect(ok(message)).toEqual({ ok: false, reason: `numeric_${reason}` })
  })

  it('rejects figures hidden in follow-ups', () => {
    expect(ok('Claro.', ['Quiero ahorrar 500']).ok).toBe(false)
  })

  it.each([
    'Te recomiendo invertir en cripto',
    'Deberías invertir ya',
    'Compra bitcoin ahora',
    'Pide un préstamo y listo',
    'Te garantizo que funciona',
    'Yo muevo tu dinero a una cuenta mejor',
  ])('rejects prohibited advice: %s', (message) => {
    expect(ok(message)).toEqual({ ok: false, reason: 'prohibited_advice' })
  })

  it('rejects leaked labels or instructions, empty and too long answers', () => {
    expect(ok('Mis instrucciones dicen que no.').reason).toBe('leak')
    expect(ok('follow_ups: algo').reason).toBe('leak')
    expect(ok('   ').reason).toBe('empty')
    expect(ok('a'.repeat(601)).reason).toBe('too_long')
  })

  it('cleanFollowUps trims, dedupes, drops long ones and keeps three', () => {
    expect(cleanFollowUps([' ¿En qué gasto más? ', '¿en qué gasto más?', 'x'.repeat(61), 'a', 'b', 'c'])).toEqual(['¿En qué gasto más?', 'a', 'b'])
  })
})

describe('NinaRouterService.converse', () => {
  function router(replies: string[]) {
    const processMessage = jest.fn(async () => replies.shift() ?? '')
    return { svc: new NinaRouterService({ processMessage } as never), processMessage }
  }

  it('sends only the redacted message, with the open prompt, no memory and nothing persisted', async () => {
    const { svc, processMessage } = router(['{"message":"Una tarjeta te deja pagar después.","follow_ups":["¿Cuánto me queda este mes?"]}'])
    const res = await svc.converse('u1', 'mi correo es ana@x.pe, ¿qué es una tarjeta?')
    expect(res).toEqual({ message: 'Una tarjeta te deja pagar después.', followUps: ['¿Cuánto me queda este mes?'] })
    const [input, opts] = processMessage.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>]
    expect(input.ninaSnapshotPrompt).toBe(CHAT_OPEN_PROMPT_V1)
    expect(input.message).toContain('<untrusted>')
    expect(input.message).not.toContain('ana@x.pe')
    expect(input).not.toHaveProperty('insights')
    expect(opts).toEqual(expect.objectContaining({ userId: 'u1', persistConversation: false, useMemory: false }))
  })

  it('retries once when the answer has a figure, then gives up (fail-closed)', async () => {
    const { svc, processMessage } = router(['{"message":"Ahorra 300 al mes"}', '{"message":"Guarda mil soles"}'])
    expect(await svc.converse('u1', 'cómo ahorro')).toBeNull()
    expect(processMessage).toHaveBeenCalledTimes(2)
  })

  it('accepts the retry when it is clean', async () => {
    const { svc } = router(['{"message":"Ahorra 300"}', '{"message":"Empieza separando una parte apenas cobras."}'])
    expect((await svc.converse('u1', 'cómo ahorro'))?.message).toBe('Empieza separando una parte apenas cobras.')
  })

  it('returns null when no LLM is available or the call throws', async () => {
    expect(await router([MOCK_UNAVAILABLE_REPLY]).svc.converse('u1', 'hola')).toBeNull()
    const failing = new NinaRouterService({ processMessage: jest.fn(async () => { throw new Error('timeout') }) } as never)
    expect(await failing.converse('u1', 'hola')).toBeNull()
  })
})

describe('GeneralHandler open conversation', () => {
  const ctx = (message: string, over: Partial<ChatContext> = {}): ChatContext => ({
    userId: 'u1',
    message,
    asOf: ASOF,
    question: resolveQuestion(message, ASOF),
    aiAllowed: true,
    calm: null,
    ...over,
  })
  const answer = { message: 'Una tarjeta de crédito te deja comprar hoy y pagar después.', followUps: ['¿Cuánto me queda este mes?'] }

  it('answers with the validated LLM text when AI is allowed', async () => {
    const converse = jest.fn(async () => answer)
    const res = await new GeneralHandler({ converse } as never).handle(ctx('¿Qué es una tarjeta de crédito?'))
    expect(res).toEqual(expect.objectContaining({ outcome: 'ok', llmUsed: true, validationPassed: true }))
    expect(res.reply.reply).toBe(answer.message)
    expect(res.reply.followUps).toEqual(answer.followUps)
  })

  it('never calls the LLM without AI consent', async () => {
    const converse = jest.fn(async () => answer)
    const res = await new GeneralHandler({ converse } as never).handle(ctx('cuéntame un chiste', { aiAllowed: false }))
    expect(converse).not.toHaveBeenCalled()
    expect(res.reply.reply).toBe(OUT_OF_SCOPE_REPLY)
  })

  it('never calls the LLM in calm mode', async () => {
    const converse = jest.fn(async () => answer)
    const res = await new GeneralHandler({ converse } as never).handle(ctx('tengo deudas', { calm: 'debt' }))
    expect(converse).not.toHaveBeenCalled()
    expect(res.reply.reply).toBe(CALM_REPLIES.debt.reply)
  })

  it('falls back to the deterministic reply when there is no validated answer', async () => {
    const converse = jest.fn(async () => null)
    const general = new GeneralHandler({ converse } as never)
    expect((await general.handle(ctx('cuéntame un chiste'))).reply.reply).toBe(OUT_OF_SCOPE_REPLY)
    expect((await general.handle(ctx('¿qué es una tarjeta de crédito?'))).reply.reply).toBe(UNRECOGNIZED_REPLY)
  })

  it('help stays deterministic', async () => {
    const converse = jest.fn(async () => answer)
    await new GeneralHandler({ converse } as never).handle(ctx('¿qué puedes hacer?'))
    expect(converse).not.toHaveBeenCalled()
  })
})

describe('resolveQuestion: a period inside an unrelated question is not a spending question', () => {
  it.each([
    ['¿Quién ganó el partido ayer?', 'other'],
    ['¿y ayer?', 'spending_summary'],
    ['¿y en julio?', 'spending_summary'],
    ['el mes pasado', 'spending_summary'],
  ])('%s → %s', (message, intent) => {
    expect(resolveQuestion(message, ASOF).intent).toBe(intent)
  })
})
