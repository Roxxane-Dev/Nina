import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeSupabase } from '../testing/fake-supabase'
import { TransactionsController } from './transactions.controller'
import { TransactionsService, validateNewTransaction, validateTransactionEdit } from './transactions.service'

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

describe('HOME-03: editing a movement', () => {
  const TODAY = new Date('2026-11-01T00:00:00Z')

  it('validates amount, date and note with the rules of a new movement', () => {
    expect(validateTransactionEdit({ amount: 45.5, date: '2026-10-30', note: ' Metro ' }, TODAY)).toEqual({
      ok: true,
      value: { amount: 45.5, date: '2026-10-30', description: 'Metro' },
    })
    expect(validateTransactionEdit({ note: '   ' }, TODAY)).toEqual({ ok: true, value: { description: null } })
    expect(validateTransactionEdit({}, TODAY)).toEqual({ ok: true, value: {} })
    for (const bad of [{ amount: 0 }, { amount: -1 }, { amount: '5' }, { amount: 1.005 }, { date: '2026-11-02' }, { date: 'ayer' }, { note: 5 }]) {
      expect(validateTransactionEdit(bad, TODAY).ok).toBe(false)
    }
  })

  function setup(rows: Array<Record<string, unknown>>) {
    const db = new FakeSupabase()
    db.rows('transactions').push(...rows)
    const svc = new TransactionsService({ get: () => undefined } as never)
    ;(svc as unknown as { db: unknown }).db = db
    const rules = { remember: jest.fn().mockResolvedValue(true) }
    const ctrl = new TransactionsController(svc, rules as never, {} as never, {} as never)
    return { db, svc, ctrl, rules }
  }
  const req = (id: string) => ({ user: { id } }) as never
  const row = (over = {}) => ({ id: 't1', user_id: 'ana', type: 'expense', amount: 10, category: 'food', description: 'menu', goal_id: null, ...over })

  it('updates only the fields sent, scoped to the JWT user', async () => {
    const t = setup([row()])
    expect(await t.ctrl.update(req('ana'), 't1', { amount: 45.5 })).toEqual({ id: 't1', remembered: false })
    expect(t.db.rows('transactions')[0]).toEqual(row({ amount: 45.5 }))
    expect(t.rules.remember).not.toHaveBeenCalled()
  })

  it("another user's movement is 404 and stays the same", async () => {
    const t = setup([row()])
    await expect(t.ctrl.update(req('beto'), 't1', { amount: 99 })).rejects.toBeInstanceOf(NotFoundException)
    expect(t.db.rows('transactions')[0]).toEqual(row())
  })

  it('category alone still remembers the rule (US-24)', async () => {
    const t = setup([row()])
    const out = await t.ctrl.update(req('ana'), 't1', { category: 'home' })
    expect(out).toEqual(expect.objectContaining({ category: 'home', remembered: true }))
    expect(t.rules.remember).toHaveBeenCalledWith('ana', 'menu', 'home')
  })

  it('a goal contribution can change its amount but not its category', async () => {
    const t = setup([row({ goal_id: 'g1', category: 'savings' })])
    await expect(t.ctrl.update(req('ana'), 't1', { category: 'home' })).rejects.toBeInstanceOf(BadRequestException)
    await t.ctrl.update(req('ana'), 't1', { amount: 80 })
    expect(t.db.rows('transactions')[0]).toEqual(expect.objectContaining({ amount: 80, category: 'savings', goal_id: 'g1' }))
  })

  it('an empty patch or a bad value is 400', async () => {
    const t = setup([row()])
    await expect(t.ctrl.update(req('ana'), 't1', {})).rejects.toBeInstanceOf(BadRequestException)
    await expect(t.ctrl.update(req('ana'), 't1', { amount: -1 })).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('DATA-01: import a bank CSV', () => {
  const ANA = 'ana'
  const CSV = 'Fecha,Descripcion,Monto\n02/10/2026,TAMBO,-12.50\n03/10/2026,UBER,-18\n'

  function setup(rules: unknown[] = []) {
    const db = new FakeSupabase()
    const svc = new TransactionsService({ get: () => undefined } as never)
    ;(svc as unknown as { db: unknown }).db = db
    const ruleSvc = { listForUser: jest.fn().mockResolvedValue(rules) }
    const accounts = { assertOwned: jest.fn().mockRejectedValue(new NotFoundException()) }
    const ctrl = new TransactionsController(svc, ruleSvc as never, {} as never, accounts as never)
    return { db, ctrl, accounts }
  }
  const req = (id = ANA) => ({ user: { id } }) as never

  it('the preview saves nothing', async () => {
    const t = setup()
    const out = await t.ctrl.previewImport(req(), { csv: CSV })
    expect(out.rows).toHaveLength(2)
    expect(out.rows[1]).toEqual(expect.objectContaining({ description: 'UBER', categoryLabel: 'Transporte', duplicate: false }))
    expect(t.db.rows('transactions')).toEqual([])
  })

  it('imports for the JWT user, marked as csv, and leaves out the chosen lines', async () => {
    const t = setup()
    expect(await t.ctrl.commitImport(req(), { csv: CSV, skipLines: [3] })).toEqual({ imported: 1, duplicates: 0 })
    expect(t.db.rows('transactions')).toEqual([
      expect.objectContaining({ user_id: ANA, amount: 12.5, type: 'expense', source_table: 'csv', space_id: 'personal', date: '2026-10-02' }),
    ])
  })

  it('the same file twice adds nothing, and the preview says so', async () => {
    const t = setup()
    await t.ctrl.commitImport(req(), { csv: CSV })
    expect((await t.ctrl.previewImport(req(), { csv: CSV })).rows.every((r) => r.duplicate)).toBe(true)
    expect(await t.ctrl.commitImport(req(), { csv: CSV })).toEqual({ imported: 0, duplicates: 2 })
    expect(t.db.rows('transactions')).toHaveLength(2)
  })

  it("another user's identical movements are not duplicates", async () => {
    const t = setup()
    await t.ctrl.commitImport(req('beto'), { csv: CSV })
    expect((await t.ctrl.commitImport(req(), { csv: CSV })).imported).toBe(2)
  })

  it('never trusts rows sent by the client: only the file counts', async () => {
    const t = setup()
    await t.ctrl.commitImport(req(), { csv: CSV, rows: [{ amount: 999999 }], user_id: 'beto' } as never)
    expect(t.db.rows('transactions').map((r) => r.amount)).toEqual([12.5, 18])
    expect(t.db.rows('transactions').every((r) => r.user_id === ANA)).toBe(true)
  })

  it("someone else's account is rejected before anything is saved", async () => {
    const t = setup()
    await expect(
      t.ctrl.commitImport(req(), { csv: CSV, accountId: '00000000-0000-4000-8000-000000000001' }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(t.db.rows('transactions')).toEqual([])
  })

  it('a file it cannot read is 400 with a clear message', async () => {
    const t = setup()
    await expect(t.ctrl.previewImport(req(), { csv: 'hola,mundo' })).rejects.toThrow('No encontré las columnas')
    await expect(t.ctrl.previewImport(req(), {})).rejects.toBeInstanceOf(BadRequestException)
  })
})
