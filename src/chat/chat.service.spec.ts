import { ChatService } from './chat.service'
import type { PendingAction } from './pending-actions.store'

function setup(opts: { pending?: PendingAction | null; expenseConf?: unknown } = {}) {
  let stored: PendingAction | null = opts.pending ?? null
  const pending = {
    get: jest.fn(async () => stored),
    set: jest.fn(async (_u: string, a: PendingAction) => { stored = a }),
    clear: jest.fn(async () => { stored = null }),
  }
  const expenses = {
    buildPendingFromMessage: jest.fn(async () => opts.expenseConf ?? null),
    insertExpenses: jest.fn(async () => ({ result: 'Gasto registrado' })),
    updateUserProfile: jest.fn(async () => null),
  }
  const income = { buildPendingFromMessage: jest.fn(async () => null), insertIncome: jest.fn() }
  const goals = { buildPendingFromMessage: jest.fn(async () => null), insertGoal: jest.fn() }
  const memory = { storeExchange: jest.fn(async () => undefined) }
  const facts = { intent: 'spending_breakdown', figures: { expenses: 100 }, engineVersion: 'v-test' }
  const engine = { factsForIntent: jest.fn(async () => facts) }
  const router = {
    explainFacts: jest.fn(async () => ({
      answer: { message: 'Gastaste S/ 100.00.', figuresUsed: ['expenses'], followUps: ['¿Y el mes pasado?'] },
      validationPassed: true,
      usedLlm: true,
    })),
  }
  const service = new ChatService(
    expenses as never, memory as never, income as never, goals as never,
    engine as never, router as never, pending as never,
  )
  return { service, pending, expenses, engine, router, getStored: () => stored }
}

describe('ChatService', () => {
  it('asks for confirmation and persists the pending expense', async () => {
    const items = [{ amount: 20, category_name: 'Comida' }]
    const t = setup({ expenseConf: { text: '¿Confirmas S/ 20 en Comida?', items } })
    const r = await t.service.handleMessage('u1', 'gasté 20 en comida')
    expect(r.needsConfirmation).toBe(true)
    expect(t.getStored()).toEqual({ kind: 'expense', payload: { items } })
  })

  it('saves the pending expense on confirm and clears it', async () => {
    const t = setup({ pending: { kind: 'expense', payload: { items: [{ amount: 20 }] } } })
    const r = await t.service.handleMessage('u1', 'sí')
    expect(t.expenses.insertExpenses).toHaveBeenCalledWith([{ amount: 20 }], 'u1')
    expect(r.reply).toBe('Gasto registrado')
    expect(t.getStored()).toBeNull()
  })

  it('cancels without saving', async () => {
    const t = setup({ pending: { kind: 'expense', payload: { items: [] } } })
    await t.service.handleMessage('u1', 'cancelar')
    expect(t.expenses.insertExpenses).not.toHaveBeenCalled()
    expect(t.getStored()).toBeNull()
  })

  it('answers questions from engine facts through the router', async () => {
    const t = setup()
    const r = await t.service.handleMessage('u1', '¿En qué gasto más?')
    expect(t.engine.factsForIntent).toHaveBeenCalledWith('u1', 'spending_breakdown')
    expect(t.router.explainFacts).toHaveBeenCalled()
    expect(r.reply).toBe('Gastaste S/ 100.00.')
    expect(r.grounded).toEqual(expect.objectContaining({ validationPassed: true, engineVersion: 'v-test' }))
  })
})
