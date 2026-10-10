import { buildFactsPayload } from '../../packages/finance-engine/src'
import { ANA_TXS } from '../../packages/finance-engine/src/__golden__/user-ana'
import { ChatService } from './chat.service'

const config = { get: (k: string) => (k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service-key' : undefined) }

function setup(opts: { expenseConf?: unknown; incomeConf?: unknown; txs?: typeof ANA_TXS } = {}) {
  const expenses = {
    buildPendingFromMessage: jest.fn(async () => opts.expenseConf ?? null),
    insertExpenses: jest.fn(async () => ({ result: 'Gasto registrado' })),
    updateUserProfile: jest.fn(async () => null),
  }
  const income = {
    buildPendingFromMessage: jest.fn(async () => opts.incomeConf ?? null),
    insertIncome: jest.fn(async () => ({ result: 'Ingreso registrado' })),
  }
  const goals = { buildPendingFromMessage: jest.fn(async () => null), insertGoal: jest.fn() }
  const memory = { storeExchange: jest.fn(async () => undefined) }
  const asOf = new Date(Date.UTC(2026, 9, 9))
  const engine = {
    factsForQuestion: jest.fn(async (_u: string, q: string) => {
      const intent = /últimos/.test(q) ? 'recent' : /puedes/.test(q) ? 'help' : 'spending_summary'
      const facts = buildFactsPayload({ intent: intent as never, txs: opts.txs ?? ANA_TXS, asOf })
      return { intent, facts, recent: intent === 'recent' ? [{ date: '2026-08-22', category: 'Comida', amount: 20, isIncome: false }] : undefined }
    }),
  }
  const router = {
    explainFacts: jest.fn(async () => ({
      answer: { message: 'En agosto 2026 gastaste S/ 1,870.30.', recommendation: 'Revisa Hogar.', figuresUsed: [], followUps: ['¿Y julio?'] },
      validationPassed: true,
      usedLlm: true,
    })),
  }
  const service = new ChatService(
    expenses as never, memory as never, income as never, goals as never,
    engine as never, router as never, config as never,
  )
  return { service, expenses, income, router }
}

describe('ChatService', () => {
  it('income → confirm with the token saves it (the bug in the screenshot)', async () => {
    const parsed = { amount: 4500, category: 'salary', description: 'sueldo' }
    const t = setup({ incomeConf: { text: 'Voy a registrar un sueldo de S/ 4500.00.\n\n¿Confirmas?', income: parsed } })

    const ask = await t.service.handleMessage('u1', 'quiero registrar mis ingresos 4500 soles este mes')
    expect(ask.needsConfirmation).toBe(true)
    expect(ask.pendingToken).toEqual(expect.any(String))

    const done = await t.service.handleMessage('u1', 'confirmar', ask.pendingToken)
    expect(t.income.insertIncome).toHaveBeenCalledWith(parsed, 'u1')
    expect(done.reply).toBe('Ingreso registrado')
  })

  it('a token from another user is rejected', async () => {
    const t = setup({ incomeConf: { text: '¿Confirmas?', income: { amount: 1 } } })
    const ask = await t.service.handleMessage('u1', 'me pagaron 1')
    const r = await t.service.handleMessage('u2', 'sí', ask.pendingToken)
    expect(t.income.insertIncome).not.toHaveBeenCalled()
    expect(r.reply).toContain('No encontré un registro pendiente')
  })

  it('cancel never saves', async () => {
    const t = setup({ expenseConf: { text: '¿Confirmas?', items: [{ amount: 20 }] } })
    const ask = await t.service.handleMessage('u1', 'gasté 20 en comida')
    await t.service.handleMessage('u1', 'no', ask.pendingToken)
    expect(t.expenses.insertExpenses).not.toHaveBeenCalled()
  })

  it('answers spending with LLM text plus an engine-built card', async () => {
    const t = setup()
    const r = await t.service.handleMessage('u1', '¿cuánto gasté?')
    expect(r.reply.startsWith('En octubre 2026 aún no tienes movimientos; te muestro agosto 2026.')).toBe(true)
    expect(r.reply).toContain('S/ 1,870.30')
    expect(r.reply).toContain('💡 Revisa Hogar.')
    expect(r.card?.title).toBe('Tu resumen')
    expect(r.card?.highlight?.amount).toBe(1870.3)
    expect(r.card?.howCalculated).toContain('octubre 2026')
    expect(r.followUps[0]).toBe('¿Y julio?')
  })

  it('recent movements skip the LLM', async () => {
    const t = setup()
    const r = await t.service.handleMessage('u1', 'muéstrame mis últimos gastos')
    expect(t.router.explainFacts).not.toHaveBeenCalled()
    expect(r.card?.rows).toHaveLength(1)
  })

  it('help and empty history answer without the LLM', async () => {
    const help = setup()
    expect((await help.service.handleMessage('u1', '¿qué puedes hacer?')).reply).toContain('agente financiero')
    const empty = setup({ txs: [] })
    expect((await empty.service.handleMessage('u1', '¿cuánto gasté?')).reply).toContain('Aún no tienes movimientos')
    expect(empty.router.explainFacts).not.toHaveBeenCalled()
  })
})
