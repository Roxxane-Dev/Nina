import { FakeSupabase } from '../testing/fake-supabase'
import { FinanceDataUnavailableError } from './errors'
import { FinanceEngineService, TRANSACTIONS_PAGE_SIZE } from './finance-engine.service'

function service(db: FakeSupabase) {
  const svc = new FinanceEngineService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  return svc
}

describe('loadTransactions reads the whole history', () => {
  it('past the 1000 rows a response can carry, without losing or repeating any', async () => {
    const db = new FakeSupabase()
    const total = TRANSACTIONS_PAGE_SIZE * 2 + 7
    for (let i = 0; i < total; i++) {
      db.rows('transactions').push({ id: `t${i}`, user_id: 'ana', type: 'expense', amount: 1, category: 'food', date: '2026-10-01' })
    }
    db.rows('transactions').push({ id: 'other', user_id: 'beto', type: 'expense', amount: 1, category: 'food', date: '2026-10-01' })
    const txs = await service(db).loadTransactions('ana')
    expect(txs).toHaveLength(total)
    expect(new Set(txs.map((t) => t.id)).size).toBe(total)
  })

  it('a failed read is an error, never an empty history', async () => {
    await expect(service(new FakeSupabase({}, ['transactions'])).loadTransactions('ana')).rejects.toBeInstanceOf(FinanceDataUnavailableError)
  })
})
