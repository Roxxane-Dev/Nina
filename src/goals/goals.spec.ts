import { GUARDS_METADATA } from '@nestjs/common/constants'
import type { EngineTransaction } from '../../packages/finance-engine/src'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { FakeSupabase } from '../testing/fake-supabase'
import { GoalService } from './goal.service'
import { goalPlanView, type GoalRow } from './goal-plans'
import { GoalsController } from './goals.controller'

const ANA = 'user-ana'
const BETO = 'user-beto'
// Mid-October 2026: Jul, Aug and Sep are the trailing full months.
const AS_OF = new Date('2026-10-15T00:00:00Z')

function goal(over: Partial<GoalRow> = {}): GoalRow {
  return {
    id: 'g1',
    name: 'Viaje',
    target_amount: 1500,
    current_amount: 450,
    // April 2027 = 6 months after October 2026.
    deadline: '2027-04-30',
    status: 'active',
    ...over,
  }
}

let seq = 0
function tx(date: string, amount: number, categorySlug = amount > 0 ? 'salary' : 'groceries'): EngineTransaction {
  seq += 1
  return {
    id: `t${seq}`,
    postedAt: new Date(`${date}T12:00:00Z`),
    amount,
    currency: 'PEN',
    categorySlug,
    merchantNormalized: categorySlug,
    isTransfer: false,
  }
}

/** Three full months (Jul–Sep 2026) with the given income and expenses each month. */
function history(income: number, expenses: number): EngineTransaction[] {
  return ['2026-07-10', '2026-08-10', '2026-09-10'].flatMap((d) => [tx(d, income), tx(d, -expenses)])
}

describe('goalPlanView', () => {
  it('plans the remaining amount (target − current), not the whole target', () => {
    const v = goalPlanView(goal(), [], AS_OF)
    expect(v.targetAmount).toBe(1500)
    expect(v.currentAmount).toBe(450)
    expect(v.remaining).toBe(1050)
    expect(v.plan.monthsLeft).toBe(6)
    expect(v.plan.requiredPerMonth).toBe(175) // 1050 / 6, not 1500 / 6
    expect(v.deadline).toBe('2027-04-30')
    expect(v.deadlinePast).toBe(false)
    expect(v.deadlineLabel).toMatch(/abril/i)
  })

  it('parses numeric strings from Postgres numeric columns', () => {
    const v = goalPlanView(goal({ target_amount: '1500.00', current_amount: '450.00' }), [], AS_OF)
    expect(v.remaining).toBe(1050)
  })

  it('a fully (or over) saved goal has nothing left to save', () => {
    expect(goalPlanView(goal({ current_amount: 1500 }), [], AS_OF).remaining).toBe(0)
    const over = goalPlanView(goal({ current_amount: 2000 }), [], AS_OF)
    expect(over.remaining).toBe(0)
    expect(over.plan.requiredPerMonth).toBe(0)
  })

  it('a past deadline is flagged and asks for no per-month amount', () => {
    const v = goalPlanView(goal({ deadline: '2026-08-31' }), history(3000, 2500), AS_OF)
    expect(v.deadlinePast).toBe(true)
    expect(v.plan.requiredPerMonth).toBeNull()
    expect(v.plan.monthsLeft).toBeNull()
    expect(v.plan.gapPerMonth).toBeNull()
  })

  it('the current month counts as past: no zero-month division', () => {
    const v = goalPlanView(goal({ deadline: '2026-10-31' }), [], AS_OF)
    expect(v.deadlinePast).toBe(true)
    expect(v.plan.requiredPerMonth).toBeNull()
  })

  it('without a deadline there is no per-month requirement', () => {
    const v = goalPlanView(goal({ deadline: null }), [], AS_OF)
    expect(v.deadline).toBeNull()
    expect(v.deadlineLabel).toBeNull()
    expect(v.deadlinePast).toBe(false)
    expect(v.plan.requiredPerMonth).toBeNull()
  })

  it('no transactions: no savings pace and insufficient confidence', () => {
    const v = goalPlanView(goal(), [], AS_OF)
    expect(v.plan.avgMonthlySavings).toBeNull()
    expect(v.plan.gapPerMonth).toBeNull()
    expect(v.plan.confidence).toBe('insufficient')
  })

  it('3 full months saving more than needed: negative gap (room to spare)', () => {
    const v = goalPlanView(goal(), history(3000, 2500), AS_OF)
    expect(v.plan.avgMonthlySavings).toBe(500)
    expect(v.plan.gapPerMonth).toBe(-325) // 175 − 500
    expect(v.plan.confidence).toBe('high')
  })

  it('3 full months saving less than needed: positive gap (shortfall)', () => {
    const v = goalPlanView(goal(), history(3000, 2900), AS_OF)
    expect(v.plan.avgMonthlySavings).toBe(100)
    expect(v.plan.gapPerMonth).toBe(75) // 175 − 100
    expect(v.plan.confidence).toBe('high')
  })

  it('ignores the current, incomplete month when computing the pace', () => {
    const v = goalPlanView(goal(), [...history(3000, 2500), tx('2026-10-05', -5000)], AS_OF)
    expect(v.plan.avgMonthlySavings).toBe(500)
  })
})

describe('GoalService.listActive', () => {
  function setup(missing: string[] = []) {
    const db = new FakeSupabase({}, missing)
    const svc = new GoalService({ get: () => undefined } as never)
    ;(svc as unknown as { db: unknown }).db = db
    return { svc, db }
  }

  it("returns only the caller's active goals, newest first", async () => {
    const { svc, db } = setup()
    db.rows('goals').push(
      { id: 'a-old', user_id: ANA, name: 'Laptop', target_amount: 4000, current_amount: 0, deadline: null, status: 'active', created_at: '2026-09-01T00:00:00Z' },
      { id: 'a-new', user_id: ANA, name: 'Viaje', target_amount: 1500, current_amount: 450, deadline: '2027-04-30', status: 'active', created_at: '2026-10-01T00:00:00Z' },
      { id: 'a-done', user_id: ANA, name: 'Bici', target_amount: 900, current_amount: 900, deadline: null, status: 'completed', created_at: '2026-10-02T00:00:00Z' },
      { id: 'b-1', user_id: BETO, name: 'Auto', target_amount: 30000, current_amount: 0, deadline: null, status: 'active', created_at: '2026-10-03T00:00:00Z' },
    )
    const rows = await svc.listActive(ANA)
    expect(rows.map((r) => r.id)).toEqual(['a-new', 'a-old'])
    expect(await svc.listActive('user-nobody')).toEqual([])
  })

  it('a database error throws FinanceDataUnavailableError', async () => {
    const { svc } = setup(['goals'])
    await expect(svc.listActive(ANA)).rejects.toBeInstanceOf(FinanceDataUnavailableError)
  })

  it('without a configured client it returns no goals', async () => {
    const svc = new GoalService({ get: () => undefined } as never)
    expect(await svc.listActive(ANA)).toEqual([])
  })
})

describe('GoalsController', () => {
  it('is guarded by SupabaseAuthGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, GoalsController) ?? []
    expect(guards).toContain(SupabaseAuthGuard)
  })

  it('uses the user id from the validated JWT and plans each goal with the engine', async () => {
    const listActive = jest.fn().mockResolvedValue([goal()])
    const loadTransactions = jest.fn().mockResolvedValue([])
    const ctrl = new GoalsController({ listActive } as never, { loadTransactions } as never)
    const out = await ctrl.list({ user: { id: ANA } } as never)
    expect(listActive).toHaveBeenCalledWith(ANA)
    expect(loadTransactions).toHaveBeenCalledWith(ANA)
    expect(out.goals).toHaveLength(1)
    expect(out.goals[0]).toEqual(expect.objectContaining({ id: 'g1', remaining: 1050 }))
  })

  it('with no goals it does not load transactions', async () => {
    const loadTransactions = jest.fn()
    const ctrl = new GoalsController({ listActive: jest.fn().mockResolvedValue([]) } as never, { loadTransactions } as never)
    expect(await ctrl.list({ user: { id: ANA } } as never)).toEqual({ goals: [] })
    expect(loadTransactions).not.toHaveBeenCalled()
  })
})
