/**
 * Regression suite for the chat (bug of 10 Oct 2026: "dime cuánto he gastado en
 * el año" → "Tuve un problema procesando tu mensaje").
 *
 * Uses the real engine, handlers and Spanish parsers, with a fake Supabase that
 * returns rows exactly as the real timestamptz column does. Only the LLM is
 * replaced (by the engine-only template) so every figure is deterministic.
 */
import { templatedAnswer } from '../nina-router/validator'
import { FinanceEngineService } from '../finance-engine/finance-engine.service'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { IncomeService } from '../income/income.service'
import { ExpensesService } from '../expenses/expenses.service'
import { GoalService } from '../goals/goal.service'
import { ChatService } from './chat.service'
import { ChatTelemetry } from './chat-telemetry'
import { ChatExceptionFilter, DATA_UNAVAILABLE_REPLY } from './chat-exception.filter'
import { ConfirmationTokens } from './confirmation-token'
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
  const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => result }
  return { from: () => chain }
}

function setup(dbResult: Parameters<typeof fakeDb>[0] = { data: ROWS, error: null }) {
  const config = { get: () => undefined } as never
  const engine = new FinanceEngineService(config, {} as never)
  ;(engine as unknown as { db: unknown }).db = fakeDb(dbResult)

  const income = new IncomeService(config)
  const insertIncome = jest.spyOn(income, 'insertIncome').mockResolvedValue({ result: '¡Ingreso de S/ 4500.00 registrado! 💚' })
  const expenses = new ExpensesService(config)
  const insertExpenses = jest.spyOn(expenses, 'insertExpenses').mockResolvedValue({ result: 'Listo, gastos registrados ✅' })
  jest.spyOn(expenses, 'updateUserProfile').mockResolvedValue(null as never)
  const goals = new GoalService(config)

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
    new RegisterIncomeHandler(tokens, income),
    new RegisterGoalHandler(tokens, goals),
    new RegisterExpenseHandler(tokens, expenses),
    new BalanceQueryHandler(engine, responder),
    new SpendingQueryHandler(engine, responder),
    new GeneralHandler(),
    memory as never,
    telemetry,
  )
  return { chat, insertIncome, insertExpenses, record, router }
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
    expect(insertIncome).toHaveBeenCalledWith(expect.objectContaining({ amount: 4500 }), 'user-1')
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

  it('telemetry never contains the message text, amounts or the raw user id', async () => {
    const { chat, record } = setup()
    await chat.handleMessage('user-1', 'quiero registrar 4500 soles de ingreso')
    await chat.handleMessage('user-1', 'dime cuanto he gastado en el año')
    const logged = JSON.stringify(record.mock.calls)
    expect(logged).not.toMatch(/4500|250\.5|registrar|gastado|user-1/)
  })
})

describe('ChatExceptionFilter', () => {
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
    new ChatExceptionFilter().catch(new FinanceDataUnavailableError('PGRST301'), h)
    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DATA_UNAVAILABLE', message: DATA_UNAVAILABLE_REPLY, requestId: 'req-1' }))
  })

  it('maps unexpected errors to 500 INTERNAL with the requestId', () => {
    const { h, status, json } = host('req-2')
    new ChatExceptionFilter().catch(new RangeError('Invalid time value'), h)
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL', requestId: 'req-2' }))
  })
})
