import { TransactionsService, validateNewTransaction } from './transactions.service'

const TODAY = new Date(Date.UTC(2026, 9, 11))

describe('validateNewTransaction (US-26)', () => {
  it('accepts a valid expense and normalizes the category', () => {
    expect(validateNewTransaction({ type: 'expense', amount: 25.5, category: 'Comida', note: '  menú  ' }, TODAY)).toEqual({
      ok: true,
      value: { type: 'expense', amount: 25.5, category: 'food', date: '2026-10-11', note: 'menú' },
    })
  })

  it.each([
    [{ type: 'transfer', amount: 10, category: 'food' }, 'type'],
    [{ type: 'expense', amount: 0, category: 'food' }, 'amount'],
    [{ type: 'expense', amount: -5, category: 'food' }, 'amount'],
    [{ type: 'expense', amount: 1.234, category: 'food' }, 'decimals'],
    [{ type: 'expense', amount: 10, category: 'food', date: '2026-10-12' }, 'future'],
    [{ type: 'expense', amount: 10, category: 'food', date: '11/10/2026' }, 'YYYY-MM-DD'],
  ])('rejects %p', (input, fragment) => {
    const v = validateNewTransaction(input as never, TODAY)
    expect(v.ok).toBe(false)
    expect(!v.ok && v.error).toContain(fragment)
  })
})

describe('TransactionsService.remove (US-25)', () => {
  function serviceWith(rows: unknown[]) {
    const calls: Array<[string, string]> = []
    const chain = {
      delete: () => chain,
      eq: (col: string, val: string) => {
        calls.push([col, val])
        return chain
      },
      select: async () => ({ data: rows, error: null }),
    }
    const svc = new TransactionsService({ get: () => undefined } as never)
    ;(svc as unknown as { db: unknown }).db = { from: () => chain }
    return { svc, calls }
  }

  it("always scopes the delete to the caller's user id", async () => {
    const { svc, calls } = serviceWith([{ id: 'tx-1' }])
    expect(await svc.remove('user-a', 'tx-1')).toBe(true)
    expect(calls).toEqual([
      ['id', 'tx-1'],
      ['user_id', 'user-a'],
    ])
  })

  it("returns false for someone else's (or a missing) row", async () => {
    const { svc } = serviceWith([])
    expect(await svc.remove('user-b', 'tx-1')).toBe(false)
  })
})
