import { BadRequestException, NotFoundException } from '@nestjs/common'
import { TransactionsController } from '../transactions/transactions.controller'
import { ExpensesService } from '../expenses/expenses.service'
import { CategoryRulesService } from './category-rules.service'

/** In-memory category_rules table shared by the fake services. */
function fakeRules() {
  const rows: Array<{ user_id: string; pattern: string; category: string }> = []
  const svc = new CategoryRulesService({ get: () => undefined } as never)
  const db = {
    from: () => ({
      select: () => ({
        eq: (_c: string, userId: string) => ({ limit: async () => ({ data: rows.filter((r) => r.user_id === userId), error: null }) }),
      }),
      upsert: async (row: { user_id: string; pattern: string; category: string }) => {
        const i = rows.findIndex((r) => r.user_id === row.user_id && r.pattern === row.pattern)
        if (i >= 0) rows[i] = row
        else rows.push(row)
        return { error: null }
      },
    }),
  }
  ;(svc as unknown as { db: unknown }).db = db
  return { svc, rows }
}

const req = (id: string) => ({ user: { id } }) as never
const TX = '11111111-1111-4111-8111-111111111111'

describe('US-24: correct a category and remember it', () => {
  function controllerWith(row: { description: string | null; type: string } | null) {
    const rules = fakeRules()
    const transactions = { updateCategory: jest.fn(async () => row), today: () => new Date() }
    return { ctrl: new TransactionsController(transactions as never, rules.svc), transactions, rules }
  }

  it('updates the category and remembers it for the description', async () => {
    const { ctrl, transactions, rules } = controllerWith({ description: 'Almuerzo en Tambo', type: 'expense' })
    const r = await ctrl.updateCategory(req('u1'), TX, { category: 'food' })
    expect(transactions.updateCategory).toHaveBeenCalledWith('u1', TX, 'food')
    expect(r).toEqual({ id: TX, category: 'food', label: 'Comida', remembered: true })
    expect(rules.rows).toEqual([expect.objectContaining({ user_id: 'u1', pattern: 'almuerzo en tambo', category: 'food' })])
  })

  it('rejects unknown categories', async () => {
    const { ctrl } = controllerWith({ description: 'x', type: 'expense' })
    await expect(ctrl.updateCategory(req('u1'), TX, { category: 'juguetes' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it("404 for someone else's movement", async () => {
    const { ctrl } = controllerWith(null)
    await expect(ctrl.updateCategory(req('u2'), TX, { category: 'food' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('the next registration with that description uses the remembered category', async () => {
    const { svc: rules } = fakeRules()
    await rules.remember('u1', 'tambo', 'food')
    const expenses = new ExpensesService({ get: () => undefined } as never, rules)
    const conf = await expenses.buildPendingFromMessage('gasté 45 en tambo', 'u1')
    expect(conf?.items[0]).toEqual(expect.objectContaining({ category_slug: 'food', category_name: 'Comida' }))
    expect(conf?.text).toContain('• S/ 45.00 en Comida') // and no hard-coded "$"

    const other = await expenses.buildPendingFromMessage('gasté 45 en tambo', 'u2')
    expect(other?.items[0].category_slug).toBe('other') // rules are per user
  })
})
