import { BadRequestException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import type { EngineTransaction } from '../../packages/finance-engine/src'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import { FakeSupabase } from '../testing/fake-supabase'
import { NudgesController } from './nudges.controller'
import { NudgesService } from './nudges.service'

const ANA = 'user-ana'
const BETO = 'user-beto'
const today = new Date().toISOString().slice(0, 10)
const tx = (amount: number, categorySlug: string): EngineTransaction => ({
  id: `t-${categorySlug}`,
  postedAt: new Date(`${today}T00:00:00Z`),
  amount,
  currency: 'PEN',
  categorySlug,
  merchantNormalized: '',
  isTransfer: false,
})

function setup(txs: EngineTransaction[]) {
  const db = new FakeSupabase({ nudge_dismissals: ['user_id', 'nudge_key'] })
  const svc = new NudgesService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  const loadTransactions = jest.fn().mockResolvedValue(txs)
  const listActive = jest.fn().mockResolvedValue([])
  return { db, loadTransactions, listActive, ctrl: new NudgesController(svc, { listActive } as never, { loadTransactions } as never) }
}
const req = (id: string) => ({ user: { id } }) as never

describe('NudgesController (NOTIF-01)', () => {
  it('is guarded by SupabaseAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, NudgesController) ?? []).toContain(SupabaseAuthGuard)
  })

  it('uses the JWT user and a dismissed nudge stays away, only for that user', async () => {
    const t = setup([tx(4000, 'salary'), tx(-30, 'subscriptions')])
    const first = await t.ctrl.list(req(ANA))
    expect(t.loadTransactions).toHaveBeenCalledWith(ANA)
    const subs = first.nudges.find((n) => n.kind === 'subscriptions')
    expect(subs).toBeDefined()

    await t.ctrl.dismiss(req(ANA), { key: subs!.key })
    await t.ctrl.dismiss(req(ANA), { key: subs!.key }) // twice is fine
    expect(t.db.rows('nudge_dismissals')).toHaveLength(1)
    expect((await t.ctrl.list(req(ANA))).nudges.map((n) => n.key)).not.toContain(subs!.key)
    expect((await t.ctrl.list(req(BETO))).nudges.map((n) => n.key)).toContain(subs!.key)
  })

  it('a bad key is 400', async () => {
    const t = setup([])
    await expect(t.ctrl.dismiss(req(ANA), {})).rejects.toBeInstanceOf(BadRequestException)
    await expect(t.ctrl.dismiss(req(ANA), { key: 'x'.repeat(121) })).rejects.toBeInstanceOf(BadRequestException)
  })
})
