import { ConversationHandler } from './conversation.handler'
import type { ChatContext } from './handler'

const outlook = {
  monthLabel: 'noviembre 2026',
  availableNow: 1200,
  expectedIncome: 3000,
  incomeDay: 15,
  overdueIncome: 0,
  recurringUntilEnd: 900,
  dailySpend: 50,
  daysLeft: 20,
  discretionaryUntilEnd: 1000,
  projected: 2300,
  confidence: 'high',
}
// 400 a month of real savings over Aug–Oct.
const txs = ['2026-08-05', '2026-09-05', '2026-10-05'].flatMap((d) => [
  { id: `i${d}`, postedAt: new Date(`${d}T00:00:00Z`), amount: 2000, currency: 'PEN', categorySlug: 'salary', merchantNormalized: '', isTransfer: false },
  { id: `e${d}`, postedAt: new Date(`${d}T00:00:00Z`), amount: -1600, currency: 'PEN', categorySlug: 'food', merchantNormalized: '', isTransfer: false },
])

function handler(withOutlook = true) {
  const engine = {
    outlook: jest.fn().mockResolvedValue({ outlook: withOutlook ? outlook : null, upcoming: [] }),
    loadTransactions: jest.fn().mockResolvedValue(txs),
    factsForResolved: jest.fn().mockResolvedValue({ facts: { context: { hasHistory: false }, figures: {} } }),
  }
  return new ConversationHandler(engine as never, {} as never, { listActive: jest.fn().mockResolvedValue([]) } as never)
}
const ctx = (message: string, intent = 'whatif'): ChatContext =>
  ({ userId: 'ana', message, asOf: new Date('2026-11-05T00:00:00Z'), question: { intent, period: {} } as never, aiAllowed: true })

describe('purchase simulation in the chat (INS-06)', () => {
  it('cash: month-end before and after, verdict and months of savings', async () => {
    const r = await handler().handle(ctx('¿qué pasa si compro una bici de 800?'))
    expect(r?.reply.reply).toBe(
      'Bici a S/ 800.00. Hagamos reality check 👀 Si la compras al contado, cerrarías noviembre 2026 con unos S/ 1,500.00 en vez de S/ 2,300.00. ' +
        'Entra sin drama. A tu ritmo de ahorro (S/ 400.00 al mes), equivale a 2 meses de ahorro. La decisión es tuya.',
    )
  })

  it('installments: one installment this month, and it says interest is not included', async () => {
    const r = await handler().handle(ctx('¿qué pasa si compro una laptop de 3000 en 6 cuotas?'))
    expect(r?.reply.reply).toContain('En 6 cuotas de S/ 500.00 (sin contar los intereses de tu tarjeta), este mes cerrarías con unos S/ 1,800.00')
  })

  it('"6 cuotas de 500" is a 3000 purchase', async () => {
    const r = await handler().handle(ctx('¿qué pasa si compro un celular en 6 cuotas de 500?'))
    expect(r?.reply.reply).toContain('Celular a S/ 3,000.00.')
  })

  it('a purchase that does not fit says so without guilt', async () => {
    const r = await handler().handle(ctx('¿me alcanza para una tele de 2500?', 'available'))
    expect(r?.reply.reply).toContain('Este mes no entra: cerrarías en rojo.')
    expect(r?.reply.reply).not.toMatch(/irresponsable|mal|deberías/i)
  })

  it('too little history to project: no simulation, no invented numbers', async () => {
    const r = await handler(false).handle(ctx('¿qué pasa si compro una bici de 800?'))
    expect(r?.reply.reply ?? '').not.toContain('cerrarías')
  })
})

describe('purchase simulation: wording found in the local walkthrough', () => {
  function withOverdue() {
    const engine = {
      outlook: jest.fn().mockResolvedValue({ outlook: { ...outlook, availableNow: -170, expectedIncome: 0, overdueIncome: 5000, projected: -888.3 }, upcoming: [] }),
      loadTransactions: jest.fn().mockResolvedValue(txs),
      factsForResolved: jest.fn(),
    }
    return new ConversationHandler(engine as never, {} as never, { listActive: jest.fn().mockResolvedValue([]) } as never)
  }

  it('an unregistered usual income is said, instead of a scary verdict', async () => {
    const r = await withOverdue().handle(ctx('¿me alcanza para unas zapatillas de 350?', 'available'))
    expect(r?.reply.reply).toContain('no estoy contando tu ingreso de siempre (unos S/ 5,000.00) porque aún no está registrado')
    expect(r?.reply.reply).not.toContain('no entra')
  })

  it('less than a month of savings is said in words, not as 0.1 months', async () => {
    const r = await handler().handle(ctx('¿me alcanza para unas zapatillas de 40?', 'available'))
    expect(r?.reply.reply).toContain('es menos de un mes de ahorro')
    expect(r?.reply.reply).not.toMatch(/0\.\d meses/)
  })
})
