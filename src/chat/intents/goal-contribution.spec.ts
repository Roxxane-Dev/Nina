import { GoalService } from '../../goals/goal.service'
import { FakeSupabase } from '../../testing/fake-supabase'
import { ConfirmationTokens } from '../confirmation-token'
import { ConfirmationHandler } from './confirmation.handler'
import { RegisterGoalHandler } from './registration.handlers'
import type { ChatContext } from './handler'

const ctx = (message: string, pendingToken?: string, userId = 'u1'): ChatContext =>
  ({ userId, message, pendingToken, asOf: new Date(), question: {} as never, aiAllowed: true })

function setup(goals: Array<{ id: string; name: string; status?: string; user_id?: string }>) {
  const db = new FakeSupabase()
  db.rows('goals').push(
    ...goals.map((g, i) => ({
      target_amount: 1000,
      current_amount: 0,
      deadline: null,
      status: 'active',
      user_id: 'u1',
      created_at: `2026-10-0${i + 1}T00:00:00Z`,
      ...g,
    })),
  )
  const goalService = new GoalService({ get: () => undefined } as never)
  ;(goalService as unknown as { db: unknown }).db = db
  const tokens = new ConfirmationTokens('t')
  return {
    db,
    register: new RegisterGoalHandler(tokens, goalService),
    confirm: new ConfirmationHandler(tokens, {} as never, {} as never, goalService),
  }
}

describe('HOME-02: "aparté 200 para Japón" from the chat', () => {
  it('asks to confirm, then records the contribution linked to the goal', async () => {
    const t = setup([{ id: 'g-jp', name: 'Viaje a Japón' }, { id: 'g-lp', name: 'Laptop' }])
    const ask = await t.register.handle(ctx('aparté 200 para Japón'))
    expect(ask?.outcome).toBe('confirmation_requested')
    expect(ask?.reply.reply).toContain('Voy a anotar S/ 200.00 apartados para tu meta "Viaje a Japón"')
    expect(ask?.reply.reply).toContain('sale de tu disponible')
    expect(t.db.rows('transactions')).toEqual([])

    const done = await t.confirm.handle(ctx('sí', ask?.reply.pendingToken))
    expect(done?.outcome).toBe('saved')
    expect(done?.reply.reply).toContain('anoté S/ 200.00 para "Viaje a Japón"')
    expect(t.db.rows('transactions')).toEqual([
      expect.objectContaining({ user_id: 'u1', amount: 200, goal_id: 'g-jp', category: 'savings', type: 'expense' }),
    ])
  })

  it('"puse 150 en mi meta laptop" is a contribution, not a new goal', async () => {
    const t = setup([{ id: 'g-lp', name: 'Laptop' }])
    const ask = await t.register.handle(ctx('puse 150 en mi meta laptop'))
    expect(ask?.reply.reply).toContain('apartados para tu meta "Laptop"')
  })

  it('with several goals and no name it asks which one, without a token', async () => {
    const t = setup([{ id: 'g-jp', name: 'Japón' }, { id: 'g-lp', name: 'Laptop' }])
    const r = await t.register.handle(ctx('ahorré 200'))
    expect(r?.reply.reply).toContain('¿Para cuál meta es?')
    expect(r?.reply.pendingToken).toBeUndefined()
  })

  it('without goals it explains how to create one', async () => {
    const t = setup([])
    const r = await t.register.handle(ctx('aparté 200 para japón'))
    expect(r?.reply.reply).toContain('Todavía no tienes metas')
    expect(r?.reply.pendingToken).toBeUndefined()
  })

  it("never matches another user's goal", async () => {
    const t = setup([{ id: 'g-beto', name: 'Japón', user_id: 'u2' }])
    const r = await t.register.handle(ctx('aparté 200 para japón'))
    expect(r?.reply.reply).toContain('Todavía no tienes metas')
  })

  it('a goal completed before confirming is not written to', async () => {
    const t = setup([{ id: 'g-jp', name: 'Japón' }])
    const ask = await t.register.handle(ctx('aparté 200 para japón'))
    ;(t.db.rows('goals')[0] as Record<string, unknown>).status = 'completed'
    const done = await t.confirm.handle(ctx('sí', ask?.reply.pendingToken))
    expect(done?.outcome).toBe('cancelled')
    expect(t.db.rows('transactions')).toEqual([])
  })

  it("another user's token cannot be confirmed", async () => {
    const t = setup([{ id: 'g-jp', name: 'Japón' }])
    const ask = await t.register.handle(ctx('aparté 200 para japón'))
    const done = await t.confirm.handle(ctx('sí', ask?.reply.pendingToken, 'u2'))
    expect(done?.outcome).toBe('no_pending')
    expect(t.db.rows('transactions')).toEqual([])
  })

  it('a plain goal still registers as a goal', async () => {
    const t = setup([])
    const ask = await t.register.handle(ctx('quiero ahorrar 2000 para un viaje'))
    expect(ask?.reply.reply).toContain('Voy a registrar una meta')
  })
})

