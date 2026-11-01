import { GUARDS_METADATA } from '@nestjs/common/constants'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { EngineTransaction } from '../../packages/finance-engine/src'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { FakeSupabase } from '../testing/fake-supabase'
import { GoalService, parseContribution } from './goal.service'
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

describe('HOME-02: goal contributions', () => {
  const TODAY = new Date('2026-10-27T00:00:00Z')

  it('goal progress = opening amount + contributions linked to the goal', () => {
    const txs = [
      { ...tx('2026-10-05', -200, 'other'), goalId: 'g1' },
      { ...tx('2026-10-20', -100, 'other'), goalId: 'g1' },
      { ...tx('2026-10-21', -999, 'other'), goalId: 'g-other' },
    ]
    const v = goalPlanView(goal(), txs, AS_OF)
    expect(v.contributed).toBe(300)
    expect(v.currentAmount).toBe(750) // 450 opening + 300
    expect(v.remaining).toBe(750)
    expect(v.plan.requiredPerMonth).toBe(125) // 750 / 6
  })

  it('parseContribution validates amount, date and note', () => {
    expect(parseContribution({ amount: 200 }, TODAY)).toEqual({ amount: 200, date: '2026-10-27', note: null })
    expect(parseContribution({ amount: 12.5, date: '2026-10-01', note: '  quincena ' }, TODAY)).toEqual({ amount: 12.5, date: '2026-10-01', note: 'quincena' })
    for (const bad of [null, {}, { amount: 0 }, { amount: -5 }, { amount: '200' }, { amount: 1.005 }, { amount: Number.NaN }, { amount: 1e9 }]) {
      expect(typeof parseContribution(bad, TODAY)).toBe('string')
    }
    expect(parseContribution({ amount: 10, date: '2026-10-28' }, TODAY)).toBe('date cannot be in the future')
    expect(parseContribution({ amount: 10, date: '27/10/2026' }, TODAY)).toBe('date must be YYYY-MM-DD')
    expect(parseContribution({ amount: 10, note: 5 }, TODAY)).toBe('note must be text')
  })

  function setup(missing: string[] = []) {
    const db = new FakeSupabase({}, missing)
    const svc = new GoalService({ get: () => undefined } as never)
    ;(svc as unknown as { db: unknown }).db = db
    db.rows('goals').push(
      { id: 'g-ana', user_id: ANA, name: 'Japón', target_amount: 26250, current_amount: 0, deadline: null, status: 'active' },
      { id: 'g-done', user_id: ANA, name: 'Bici', target_amount: 900, current_amount: 900, deadline: null, status: 'completed' },
      { id: 'g-beto', user_id: BETO, name: 'Auto', target_amount: 30000, current_amount: 0, deadline: null, status: 'active' },
    )
    return { svc, db }
  }

  it('records a personal savings movement linked to the goal', async () => {
    const { svc, db } = setup()
    const row = await svc.addContribution(ANA, 'g-ana', { amount: 200, date: '2026-10-27', note: null })
    expect(row.id).toBe('g-ana')
    expect(db.rows('transactions')).toEqual([
      expect.objectContaining({ user_id: ANA, amount: 200, type: 'expense', category: 'savings', goal_id: 'g-ana', date: '2026-10-27', description: 'Apartado · Japón', space_id: 'personal' }),
    ])
    expect(db.rows('transactions')[0]).not.toHaveProperty('shared_space_id')
  })

  it("another user's goal or an inactive goal is 404 and nothing is written", async () => {
    const { svc, db } = setup()
    await expect(svc.addContribution(ANA, 'g-beto', { amount: 200, date: '2026-10-27', note: null })).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.addContribution(ANA, 'g-done', { amount: 200, date: '2026-10-27', note: null })).rejects.toBeInstanceOf(NotFoundException)
    expect(db.rows('transactions')).toEqual([])
  })

  it('a database error throws FinanceDataUnavailableError', async () => {
    const { svc } = setup(['goals'])
    await expect(svc.addContribution(ANA, 'g-ana', { amount: 1, date: '2026-10-27', note: null })).rejects.toBeInstanceOf(FinanceDataUnavailableError)
  })

  it('the controller uses the JWT user, rejects bad bodies and returns the updated goal', async () => {
    const addContribution = jest.fn().mockResolvedValue(goal())
    const loadTransactions = jest.fn().mockResolvedValue([{ ...tx('2026-10-05', -50, 'other'), goalId: 'g1' }])
    const ctrl = new GoalsController({ addContribution } as never, { loadTransactions } as never)
    const out = await ctrl.contribute({ user: { id: ANA } } as never, 'g1', { amount: 50, user_id: BETO })
    expect(addContribution).toHaveBeenCalledWith(ANA, 'g1', expect.objectContaining({ amount: 50 }))
    expect(out.goal.currentAmount).toBe(500)
    await expect(ctrl.contribute({ user: { id: ANA } } as never, 'g1', { amount: -1 })).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('HOME-04: goal withdrawals', () => {
  const GID = 'g1'
  function setup(contributed = 300) {
    const db = new FakeSupabase()
    db.rows('goals').push({ id: GID, user_id: ANA, name: 'Japón', target_amount: 1000, current_amount: 0, deadline: null, status: 'active' })
    const svc = new GoalService({ get: () => undefined } as never)
    ;(svc as unknown as { db: unknown }).db = db
    const loadTransactions = jest.fn(async () => [
      { ...tx('2026-10-05', -contributed, 'other'), goalId: GID },
      ...db.rows('transactions').map((r) => ({ ...tx('2026-10-06', Number(r.amount), 'other'), goalId: GID })),
    ])
    return { db, ctrl: new GoalsController(svc, { loadTransactions } as never) }
  }
  const req = { user: { id: ANA } } as never

  it('records an income-type movement linked to the goal and lowers its progress', async () => {
    const t = setup()
    const out = await t.ctrl.withdraw(req, GID, { amount: 100 })
    expect(t.db.rows('transactions')).toEqual([
      expect.objectContaining({ user_id: ANA, amount: 100, type: 'income', category: 'savings', goal_id: GID, description: 'Retiro · Japón' }),
    ])
    expect(out.goal.currentAmount).toBe(200)
  })

  it('never more than the goal holds', async () => {
    const t = setup(50)
    await expect(t.ctrl.withdraw(req, GID, { amount: 50.01 })).rejects.toBeInstanceOf(BadRequestException)
    expect(t.db.rows('transactions')).toEqual([])
    await t.ctrl.withdraw(req, GID, { amount: 50 })
    expect(t.db.rows('transactions')).toHaveLength(1)
  })

  it("another user's goal is 404 and nothing is written", async () => {
    const t = setup()
    await expect(t.ctrl.withdraw({ user: { id: BETO } } as never, GID, { amount: 10 })).rejects.toBeInstanceOf(NotFoundException)
    expect(t.db.rows('transactions')).toEqual([])
  })

  it('a bad amount is 400', async () => {
    const t = setup()
    await expect(t.ctrl.withdraw(req, GID, { amount: -5 })).rejects.toBeInstanceOf(BadRequestException)
  })
})
