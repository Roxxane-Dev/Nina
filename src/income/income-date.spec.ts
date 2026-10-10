import { IncomeService } from './income.service'
import { ExpensesService } from '../expenses/expenses.service'

// Registrations must be stamped with the Lima calendar day, not the UTC day.
describe('registration date (America/Lima)', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-10T02:30:00Z')) // 9:30 p.m. Oct 9 in Lima
  })
  afterAll(() => jest.useRealTimers())

  function fakeDb() {
    const insert = jest.fn(async () => ({ error: null }))
    return { db: { from: () => ({ insert }) }, insert }
  }

  it('income registered at night in Lima keeps that day', async () => {
    const svc = new IncomeService({ get: () => undefined } as never)
    const { db, insert } = fakeDb()
    ;(svc as unknown as { db: unknown }).db = db
    await svc.insertIncome({ amount: 4500, category: 'salary', description: 'sueldo' } as never, 'u1')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-09' }))
  })

  it('expenses registered at night in Lima keep that day', async () => {
    const svc = new ExpensesService({ get: () => undefined } as never)
    const { db, insert } = fakeDb()
    ;(svc as unknown as { db: unknown }).db = db
    await svc.insertExpenses([{ amount: 25, category_id: 'x', category_name: 'Transporte', category_slug: 'transport', description: 'taxi' }], 'u1')
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ date: '2026-10-09' })])
  })
})
