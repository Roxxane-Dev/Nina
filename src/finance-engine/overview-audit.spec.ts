import { FinanceEngineController } from './finance-engine.controller'
import { FinanceEngineService } from './finance-engine.service'

const ROWS = [
  { id: 'r1', type: 'income', amount: 4500, category: 'salary', description: 'sueldo', date: '2026-09-01T00:00:00+00:00' },
  { id: 'r2', type: 'expense', amount: 120.5, category: 'food', description: 'super', date: '2026-10-03T00:00:00+00:00' },
  { id: 'r3', type: 'expense', amount: 80, category: 'transport', description: 'taxi', date: '2026-09-30T00:00:00+00:00' },
]

function setup() {
  const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: ROWS, error: null }) }
  const engine = new FinanceEngineService({ get: () => undefined } as never)
  ;(engine as unknown as { db: unknown }).db = { from: () => chain }
  return new FinanceEngineController(engine)
}

describe('GET /v1/overview audit block (PRD-AUD-06)', () => {
  const req = { user: { id: 'user-1' } } as never

  it('returns the formula, period, count and evidence behind "available"', async () => {
    const res: any = await setup().overview(req, '2026-09')
    expect(res.available).toBe(4420)
    expect(res.audit).toMatchObject({
      metric: 'available',
      period: { from: '2026-09-01', to: '2026-09-30', label: 'setiembre 2026' },
      income: 4500,
      expenses: 80,
      available: 4420,
      txnCount: 2,
      evidenceTxnIds: ['r1', 'r3'],
    })
    expect(res.audit.formula).toContain('setiembre 2026')
  })

  it('the audit figure always equals the displayed figure', async () => {
    for (const period of ['2026-09', '2026-08']) {
      const res: any = await setup().overview(req, period)
      expect(res.audit.available).toBe(res.available)
      expect(res.audit.txnCount).toBe(res.txnCount)
      expect(res.audit.evidenceTxnIds).toHaveLength(res.txnCount)
    }
  })
})
