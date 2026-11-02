/**
 * Regression suite for the chat (bug of 10 Oct 2026: "dime cuánto he gastado en
 * el año" → "Tuve un problema procesando tu mensaje").
 *
 * Uses the real engine, handlers and Spanish parsers, with a fake Supabase that
 * returns rows exactly as the real timestamptz column does. Only the LLM is
 * replaced (by the engine-only template) so every figure is deterministic.
 */
import { looseAnswer, templatedAnswer } from '../nina-router/validator'
import { FinanceEngineService } from '../finance-engine/finance-engine.service'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { IncomeService } from '../income/income.service'
import { ExpensesService } from '../expenses/expenses.service'
import { GoalService } from '../goals/goal.service'
import { GoalPlanHandler } from './intents/goal-plan.handler'
import { ChatService } from './chat.service'
import { ChatTelemetry } from './chat-telemetry'
import { ApiExceptionFilter, DATA_UNAVAILABLE_REPLY } from '../common/api-exception.filter'
import { ConfirmationTokens } from './confirmation-token'
import { ContextTokens } from './conversation-context'
import { ConversationHandler } from './intents/conversation.handler'
import { WORRY_PREFIX } from './calm-mode'
import type { GoalRow } from '../goals/goal-plans'
import { ConfirmationHandler } from './intents/confirmation.handler'
import { GeneralHandler, UNRECOGNIZED_REPLY } from './intents/general.handler'
import { BalanceQueryHandler, SpendingQueryHandler } from './intents/query.handlers'
import { QueryResponder } from './intents/query-responder'
import {
  RegisterExpenseHandler,
  RegisterGoalHandler,
  RegisterIncomeHandler,
} from './intents/registration.handlers'

// Exactly what Supabase returns for the real transactions table.
const ROWS = [
  { id: 'r1', type: 'income', amount: 4500, category: 'salary', description: 'sueldo', date: '2026-10-10T00:00:00+00:00' },
  { id: 'r2', type: 'expense', amount: 120, category: 'comida', description: 'mercado', date: '2026-09-12T00:00:00+00:00' },
  { id: 'r3', type: 'expense', amount: 80.5, category: 'transport', description: 'taxi', date: '2026-09-20T00:00:00+00:00' },
  { id: 'r4', type: 'income', amount: 1500, category: 'freelance', description: 'proyecto', date: '2026-07-05T00:00:00+00:00' },
  { id: 'r5', type: 'expense', amount: 50, category: 'other', description: 'varios', date: '2026-05-30T00:00:00+00:00' },
]

function fakeDb(result: { data: unknown[] | null; error: { code: string; message: string } | null }) {
  const chain = { select: () => chain, eq: () => chain, order: () => chain, range: async () => result }
  return { from: () => chain }
}

function setup(
  dbResult: Parameters<typeof fakeDb>[0] = { data: ROWS, error: null },
  aiAllowed = true,
  conversational?: { goals?: GoalRow[] },
) {
  const config = { get: () => undefined } as never
  const engine = new FinanceEngineService(config)
  ;(engine as unknown as { db: unknown }).db = fakeDb(dbResult)

  const income = new IncomeService(config)
  const insertIncome = jest.spyOn(income, 'insertIncome').mockResolvedValue({ result: '¡Ingreso de S/ 4500.00 registrado! 💚' })
  const expenses = new ExpensesService(config)
  const insertExpenses = jest.spyOn(expenses, 'insertExpenses').mockResolvedValue({ result: 'Listo, gastos registrados ✅' })
  jest.spyOn(expenses, 'updateUserProfile').mockResolvedValue(null as never)
  const goals = new GoalService(config)
  const listActive = jest.spyOn(goals, 'listActive').mockResolvedValue(conversational?.goals ?? [])

  // LLM replaced by the engine-only answer: every figure comes from FACTS.
  const router = {
    explainFacts: jest.fn(async (_u: string, _q: string, facts: never) => ({
      answer: templatedAnswer(facts),
      validationPassed: false,
      usedLlm: false,
    })),
  }
  const tokens = new ConfirmationTokens('test-secret')
  const responder = new QueryResponder(router as never)
  const telemetry = new ChatTelemetry()
  const record = jest.spyOn(telemetry, 'record').mockImplementation(() => undefined)
  const memory = { storeExchange: jest.fn(async () => undefined) }

  const chat = new ChatService(
    new ConfirmationHandler(tokens, expenses, income, goals),
    new GoalPlanHandler(engine, responder, tokens, config),
    new RegisterIncomeHandler(tokens, income),
    new RegisterGoalHandler(tokens, goals),
    new RegisterExpenseHandler(tokens, expenses),
    new BalanceQueryHandler(engine, responder),
    new SpendingQueryHandler(engine, responder),
    new GeneralHandler(),
    memory as never,
    telemetry,
    { allowsAi: async () => aiAllowed } as never,
    conversational ? new ConversationHandler(engine, responder, goals) : undefined,
    conversational ? new ContextTokens('test-context-secret') : undefined,
  )
  const insertGoal = jest.spyOn(goals, 'insertGoal').mockResolvedValue({ result: 'Meta guardada 🎯' })
  return { chat, insertIncome, insertExpenses, insertGoal, record, router, memory, listActive }
}

describe('chat regression (real Supabase date format)', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-10T15:00:00Z')) // 10 a.m. in Lima
  })
  afterAll(() => jest.useRealTimers())

  it('"dime cuánto he gastado en el año" answers with engine figures for the year', async () => {
    const { chat, record } = setup()
    const r = await chat.handleMessage('user-1', 'dime cuanto he gastado en el año')
    expect(r.reply).toContain('En el año 2026 gastaste S/ 250.50 e ingresaste S/ 6,000.00')
    expect(r.card?.subtitle).toBe('El año 2026 · 5 movimientos')
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ handler: 'spending_query', intent: 'spending_summary', period: 'year', outcome: 'template_fallback' }))
  })

  it('"dime cuánto he gastado el último mes" answers for September', async () => {
    const { chat } = setup()
    const r = await chat.handleMessage('user-1', 'dime cuanto he gastado el ultimo mes')
    expect(r.reply).toContain('En setiembre 2026 gastaste S/ 200.50')
    expect(r.card?.highlight?.amount).toBe(200.5)
  })

  it('"¿cuál es mi saldo?" is the historical balance', async () => {
    const { chat } = setup()
    const r = await chat.handleMessage('user-1', '¿cuál es mi saldo?')
    expect(r.reply).toContain('tu saldo es S/ 5,749.50')
    expect(r.card?.title).toBe('Tu saldo')
  })

  it('a period without movements is not an error', async () => {
    const { chat, record } = setup()
    const r = await chat.handleMessage('user-1', '¿cuánto gasté en agosto?')
    expect(r.reply).toBe('No tengo movimientos registrados en agosto 2026 todavía.')
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'no_data' }))
  })

  it('distress wins over a data question: fixed reply with the helpline, no figures, no LLM', async () => {
    const { chat, router, record } = setup()
    const r = await chat.handleMessage('user-1', 'ya no puedo más, ¿cuánto gasté este mes?')
    expect(r.reply).toContain('Línea 113 del Minsa')
    expect(r.reply).not.toContain('S/')
    expect(/\p{Extended_Pictographic}/u.test(r.reply)).toBe(false)
    expect(router.explainFacts).not.toHaveBeenCalled()
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ handler: 'calm', outcome: 'ok', llmUsed: false }))
  })

  it('an income-loss STATEMENT with a period word gets the fixed reply, not a spending summary', async () => {
    const { chat, router } = setup()
    const r = await chat.handleMessage('user-1', 'me despidieron ayer')
    expect(r.reply.startsWith('Lamento lo de tu trabajo')).toBe(true)
    expect(r.reply).not.toContain('S/')
    expect(router.explainFacts).not.toHaveBeenCalled()
  })

  it('a debt statement gets the fixed reply', async () => {
    const { chat } = setup()
    const r = await chat.handleMessage('user-1', 'tengo muchas deudas')
    expect(r.reply.startsWith('Entiendo que esto pesa')).toBe(true)
  })

  it('debt still answers a data question from the engine template, calmly', async () => {
    const { chat, router } = setup()
    const r = await chat.handleMessage('user-1', 'tengo deudas, ¿cuánto gasté este mes?')
    expect(r.reply.startsWith('Vamos con calma.')).toBe(true)
    expect(router.explainFacts).not.toHaveBeenCalled()
  })

  it('an unrecognized finance question asks to rephrase', async () => {
    const { chat, record } = setup()
    const r = await chat.handleMessage('user-1', 'mi plata está rara')
    expect(r.reply).toBe(UNRECOGNIZED_REPLY)
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'unrecognized' }))
  })

  it('registering an income still works exactly as before', async () => {
    const { chat, insertIncome } = setup()
    const ask = await chat.handleMessage('user-1', 'quiero registrar 4500 soles de ingreso')
    expect(ask.reply).toContain('S/ 4500.00')
    expect(ask.needsConfirmation).toBe(true)

    const done = await chat.handleMessage('user-1', 'confirmar', ask.pendingToken)
    expect(insertIncome).toHaveBeenCalledWith(expect.objectContaining({ amount: 4500 }), 'user-1', undefined) // personal
    expect(done.reply).toBe('¡Ingreso de S/ 4500.00 registrado! 💚')
  })

  it('registering an expense still asks to confirm', async () => {
    const { chat, insertExpenses } = setup()
    const ask = await chat.handleMessage('user-1', 'gasté 25 en taxi')
    expect(ask.needsConfirmation).toBe(true)
    await chat.handleMessage('user-1', 'sí', ask.pendingToken)
    expect(insertExpenses).toHaveBeenCalled()
  })

  it('a database failure is DATA_UNAVAILABLE, logged with its stack', async () => {
    const { chat, record } = setup({ data: null, error: { code: 'PGRST301', message: 'down' } })
    await expect(chat.handleMessage('user-1', '¿cuánto gasté este mes?')).rejects.toBeInstanceOf(FinanceDataUnavailableError)
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'error', errorType: 'FinanceDataUnavailableError', stack: expect.any(String) }),
    )
  })

  it('FR-02: without AI consent no data reaches an LLM, answers still use engine figures', async () => {
    const { chat, router, memory } = setup(undefined, false)
    const r = await chat.handleMessage('user-1', 'dime cuanto he gastado en el año')
    expect(router.explainFacts).not.toHaveBeenCalled()
    expect(memory.storeExchange).not.toHaveBeenCalled()
    expect(r.reply).toContain('S/ 250.50')
    expect(r.grounded?.usedLlm).toBe(false)
  })

  it('telemetry never contains the message text, amounts or the raw user id', async () => {
    const { chat, record } = setup()
    await chat.handleMessage('user-1', 'quiero registrar 4500 soles de ingreso')
    await chat.handleMessage('user-1', 'dime cuanto he gastado en el año')
    const logged = JSON.stringify(record.mock.calls)
    expect(logged).not.toMatch(/4500|250\.5|registrar|gastado|user-1/)
  })
})

describe('goal plans (a question is answered with a plan, never registered as a goal)', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-10T15:00:00Z'))
  })
  afterAll(() => jest.useRealTimers())

  it('the Japan message: plan in soles converted from dollars, offered for saving with the right name and date', async () => {
    const { chat, insertGoal } = setup()
    const r = await chat.handleMessage(
      'user-1',
      'dime quiero viajar a japon en 2028 y quiero ahorrar una bolsita de 6000 dolares cual seria mi plan pra llegar a ese ahorro meta',
    )
    expect(r.reply).toContain('S/ 22,500.00')
    expect(r.reply).toContain('US$ 6,000')
    expect(r.reply).toContain('diciembre 2028')
    expect(r.reply).toContain('S/ 865.38 al mes durante 26 meses')
    expect(r.reply).toContain('Viaje a Japón')
    expect(r.reply).not.toContain('Mi Meta')
    expect(r.needsConfirmation).toBe(true)
    expect(r.card?.title).toBe('Plan: Viaje a Japón')
    expect(insertGoal).not.toHaveBeenCalled()

    await chat.handleMessage('user-1', 'sí', r.pendingToken)
    expect(insertGoal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Viaje a Japón', target_amount: 22500, deadline: '2028-12-31', original_usd: 6000, usd_pen_rate: 3.75, deadline_year_only: true }),
      'user-1',
    )
  })

  it('"como alcanzo mi meta de 6000 soles para enero 2028" is a plan, not a goal called "enero"', async () => {
    const { chat } = setup()
    const r = await chat.handleMessage('user-1', 'como alcanzo mi meta de 6000 soles para enero 2028')
    expect(r.reply).toContain('S/ 400.00 al mes durante 15 meses')
    expect(r.reply).not.toMatch(/llamada "enero"/i)
    expect(r.grounded?.intent).toBe('goal_plan')
  })

  it('without an amount it asks for it and offers nothing to save', async () => {
    const { chat, insertGoal } = setup()
    const r = await chat.handleMessage('user-1', 'como alcanzo mi meta')
    expect(r.reply).toContain('de cuánto es la meta')
    expect(r.needsConfirmation).toBe(false)
    expect(insertGoal).not.toHaveBeenCalled()
  })

  it('a date that already passed gets a clear answer, not a made-up plan', async () => {
    const { chat } = setup()
    const r = await chat.handleMessage('user-1', 'como alcanzo 3000 soles para enero 2026')
    expect(r.reply).toContain('ya pasó')
  })

  it('declaring a goal still asks to register it, now with its date', async () => {
    const { chat } = setup()
    const r = await chat.handleMessage('user-1', 'quiero ahorrar 2000 soles para un viaje en diciembre')
    expect(r.needsConfirmation).toBe(true)
    expect(r.reply).toContain('S/ 2,000.00')
    expect(r.reply).toContain('diciembre 2026')
  })
})

/** Every "S/ x" amount in a reply, as numbers. */
function solesIn(text: string): number[] {
  return [...text.matchAll(/S\/\s?(-?[\d,]+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1].replace(/,/g, '')))
}

describe('multi-turn conversation (signed context)', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-10T15:00:00Z')) // October: income 4500, no expenses yet
  })
  afterAll(() => jest.useRealTimers())

  const conversational = { goals: [] as GoalRow[] }

  it('(a) Japan question asks for the budget; "7000 dolares" with the context returns the plan and the save offer', async () => {
    const { chat, insertGoal } = setup(undefined, true, conversational)
    const ask = await chat.handleMessage('user-1', 'dime quiero viajar a japon en enero 2028 crees que sea buena idea?')
    expect(ask.reply).toContain('Viaje a Japón para enero 2028')
    expect(ask.reply).toContain('¿De cuánto es el presupuesto?')
    expect(ask.needsConfirmation).toBe(false)
    expect(ask.context).toEqual(expect.any(String))

    const plan = await chat.handleMessage('user-1', '7000 dolares', undefined, 'local', ask.context)
    expect(plan.grounded?.intent).toBe('goal_plan')
    expect(plan.card?.title).toBe('Plan: Viaje a Japón')
    expect(plan.reply).toContain('US$ 7,000')
    expect(plan.reply).toContain('S/ 26,250.00')
    expect(plan.reply).toContain('S/ 1,750.00 al mes durante 15 meses')
    expect(plan.needsConfirmation).toBe(true)
    expect(plan.pendingToken).toEqual(expect.any(String))
    expect(insertGoal).not.toHaveBeenCalled()

    await chat.handleMessage('user-1', 'sí', plan.pendingToken, 'local', plan.context)
    expect(insertGoal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Viaje a Japón', target_amount: 26250, deadline: '2028-01-31', original_usd: 7000 }),
      'user-1',
    )
  })

  it('(a\') "7000 dolares" without the context is not a plan', async () => {
    const { chat } = setup(undefined, true, conversational)
    const r = await chat.handleMessage('user-1', '7000 dolares')
    expect(r.grounded?.intent).not.toBe('goal_plan')
    expect(r.needsConfirmation).toBe(false)
  })

  it('a context signed for another user is ignored', async () => {
    const { chat } = setup(undefined, true, conversational)
    const ask = await chat.handleMessage('user-1', 'dime quiero viajar a japon en enero 2028 crees que sea buena idea?')
    const r = await chat.handleMessage('user-2', '7000 dolares', undefined, 'local', ask.context)
    expect(r.grounded?.intent).not.toBe('goal_plan')
  })

  it('(b) shoes: asks the price, then answers with the engine available figure and the price, never available − price', async () => {
    const goal: GoalRow = { id: 'g1', name: 'Viaje a Japón', target_amount: 26250, current_amount: 0, deadline: '2028-01-31', status: 'active' }
    const { chat, listActive } = setup(undefined, true, { goals: [goal] })
    const ask = await chat.handleMessage('user-1', 'Quiero comprarme unas zapatillas')
    expect(ask.reply).toContain('unas zapatillas')
    expect(ask.reply).toContain('¿Cuánto cuestan?')
    expect(ask.card).toBeUndefined()
    expect(ask.context).toEqual(expect.any(String))

    const r = await chat.handleMessage('user-1', 'Cuestan 350 soles', undefined, 'local', ask.context)
    expect(listActive).toHaveBeenCalledWith('user-1')
    expect(r.reply).toContain('S/ 350.00')
    expect(r.reply).toContain('te quedan S/ 4,500.00') // engine available for October (4500 − 0)
    expect(r.reply).toContain('«Viaje a Japón»')
    expect(r.card).toBeDefined()
    expect(r.card?.highlight?.amount).toBe(4500)
    expect(r.grounded?.intent).toBe('available')
    expect(r.grounded?.usedLlm).toBe(false)
    // No simulation: the difference is never computed or shown.
    expect(r.reply).not.toMatch(/4,?150/)
    expect(solesIn(r.reply)).not.toContain(4150)
    expect(r.needsConfirmation).toBe(false)
  })

  it('(c) "¿Cuánto me queda?" then "no entiendo, más simple" re-explains the same engine figures', async () => {
    const { chat } = setup(undefined, true, conversational)
    const first = await chat.handleMessage('user-1', '¿Cuánto me queda?')
    expect(first.grounded?.intent).toBe('available')
    const firstFigures = solesIn(first.reply)
    expect(firstFigures).toContain(4500)

    const simple = await chat.handleMessage('user-1', 'no entiendo, más simple', undefined, 'local', first.context)
    expect(simple.reply.startsWith('Va, en simple')).toBe(true)
    expect(simple.grounded?.intent).toBe('available')
    expect(solesIn(simple.reply).sort()).toEqual(firstFigures.sort())
    expect(simple.card?.highlight?.amount).toBe(first.card?.highlight?.amount)
  })

  it('(c\') "más simple" without context asks what was unclear, with no figures', async () => {
    const { chat } = setup(undefined, true, conversational)
    const r = await chat.handleMessage('user-1', 'no entiendo, más simple')
    expect(r.reply).not.toContain('S/')
    expect(r.grounded).toBeUndefined()
  })

  it('(d) worry gets WORRY_PREFIX and the engine figures, no emoji, no LLM', async () => {
    const { chat, router } = setup(undefined, true, conversational)
    const r = await chat.handleMessage('user-1', 'me preocupa no llegar a fin de mes')
    expect(r.reply.startsWith(WORRY_PREFIX)).toBe(true)
    expect(r.reply).toContain('S/ 4,500.00')
    expect(/\p{Extended_Pictographic}/u.test(r.reply)).toBe(false)
    expect(r.grounded?.intent).toBe('available')
    expect(router.explainFacts).not.toHaveBeenCalled()
  })

  it('(e) distress still gets the fixed reply with the helpline, even with conversation wired', async () => {
    const { chat, router } = setup(undefined, true, conversational)
    const r = await chat.handleMessage('user-1', 'ya no puedo más, ¿cuánto gasté este mes?')
    expect(r.reply).toContain('Línea 113 del Minsa')
    expect(r.reply).not.toContain('S/')
    expect(r.context).toBeUndefined()
    expect(router.explainFacts).not.toHaveBeenCalled()
  })

  it('(f) a forecast question says projections are not ready and shows only what is known', async () => {
    const { chat, router } = setup(undefined, true, conversational)
    const r = await chat.handleMessage('user-1', '¿cuánta plata voy a tener el próximo mes?')
    expect(r.reply.startsWith('Todavía no te proyecto')).toBe(true)
    expect(r.grounded?.intent).toBe('available')
    // Only this month's engine figures (income 4500, expenses 0, available 4500): nothing projected.
    for (const n of solesIn(r.reply)) expect([0, 4500]).toContain(n)
    expect(r.card?.highlight?.amount).toBe(4500)
    expect(router.explainFacts).not.toHaveBeenCalled()
  })

  it('(g) looseAnswer strips "recommendation:/follow_ups:" labels from plain-text LLM output', () => {
    const a = looseAnswer(
      'Este mes te quedan S/ 4,500.00. **recommendation:** Aparta una parte apenas cobres. follow_ups: ["¿En qué gasto más?"]',
      ['available'],
    )
    expect(a.message).toBe('Este mes te quedan S/ 4,500.00.')
    expect(a.recommendation).toBe('Aparta una parte apenas cobres.')
    expect(a.message).not.toMatch(/recommendation|follow_ups/i)
    expect(a.followUps).toEqual([])
    expect(looseAnswer('Solo texto.', []).message).toBe('Solo texto.')
  })
})

describe('ApiExceptionFilter', () => {
  function host(requestId?: string) {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))
    const h = {
      switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ chatRequestId: requestId }) }),
    }
    return { h: h as never, status, json }
  }

  it('maps data outages to 503 DATA_UNAVAILABLE with the requestId', () => {
    const { h, status, json } = host('req-1')
    new ApiExceptionFilter().catch(new FinanceDataUnavailableError('PGRST301'), h)
    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DATA_UNAVAILABLE', message: DATA_UNAVAILABLE_REPLY, requestId: 'req-1' }))
  })

  it('maps unexpected errors to 500 INTERNAL with the requestId', () => {
    const { h, status, json } = host('req-2')
    new ApiExceptionFilter().catch(new RangeError('Invalid time value'), h)
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL', requestId: 'req-2' }))
  })
})
