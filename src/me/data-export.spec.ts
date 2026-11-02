import { GUARDS_METADATA } from '@nestjs/common/constants'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { FakeSupabase } from '../testing/fake-supabase'
import { DataExportService, EXPORT_PAGE_SIZE } from './data-export.service'
import { MeController } from './me.controller'

const ANA = 'user-ana'
const BETO = 'user-beto'

function setup(missing: string[] = []) {
  const db = new FakeSupabase({}, missing)
  const svc = new DataExportService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  return { db, svc }
}

describe('SEC-04: export my data', () => {
  it('brings only the rows of the caller', async () => {
    const { db, svc } = setup()
    db.rows('transactions').push({ id: 't1', user_id: ANA, amount: 10 }, { id: 't2', user_id: BETO, amount: 99 })
    db.rows('profiles').push({ id: ANA, email: 'a@x.pe' }, { id: BETO, email: 'b@x.pe' })
    db.rows('spaces').push({ id: 's1', owner_id: BETO })
    const out = await svc.collect(ANA)
    expect(out.tables.transactions).toEqual([{ id: 't1', user_id: ANA, amount: 10 }])
    expect(out.tables.profiles).toEqual([{ id: ANA, email: 'a@x.pe' }])
    expect(out.tables.spaces).toEqual([])
    expect(JSON.stringify(out)).not.toContain(BETO)
  })

  it('covers the tables with personal data', async () => {
    const out = await setup().svc.collect(ANA)
    for (const t of ['transactions', 'goals', 'accounts', 'budgets', 'messages', 'consents', 'category_rules', 'space_members']) {
      expect(out.tables).toHaveProperty(t)
    }
    expect(out.formatVersion).toBe(1)
  })

  it('reads past the page size, without losing or repeating rows', async () => {
    const { db, svc } = setup()
    const total = EXPORT_PAGE_SIZE * 2 + 5
    for (let i = 0; i < total; i++) db.rows('transactions').push({ id: `t${String(i).padStart(5, '0')}`, user_id: ANA })
    const rows = (await svc.collect(ANA)).tables.transactions as Array<{ id: string }>
    expect(rows).toHaveLength(total)
    expect(new Set(rows.map((r) => r.id)).size).toBe(total)
  })

  it('an incomplete export fails instead of passing for the whole thing', async () => {
    await expect(setup(['messages']).svc.collect(ANA)).rejects.toBeInstanceOf(FinanceDataUnavailableError)
  })

  it('uses the user from the validated JWT and is not cached', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MeController) ?? []).toContain(SupabaseAuthGuard)
    const collect = jest.fn().mockResolvedValue({ formatVersion: 1 })
    const ctrl = new MeController({ get: () => undefined } as never, { collect } as never)
    await ctrl.export({ user: { id: ANA } } as never)
    expect(collect).toHaveBeenCalledWith(ANA)
    expect(Reflect.getMetadata('__headers__', MeController.prototype.export)).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Cache-Control', value: 'no-store' })]),
    )
  })
})
