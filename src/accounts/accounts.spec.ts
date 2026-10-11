import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeSupabase } from '../testing/fake-supabase'
import { AccountsNotReadyError, AccountsService, validateAccountInput } from './accounts.service'

function setup(missing: string[] = []) {
  const db = new FakeSupabase({}, missing)
  const svc = new AccountsService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  return { svc, db }
}

describe('Accounts (US-41)', () => {
  it('creates and lists only the caller’s accounts', async () => {
    const { svc } = setup()
    const a = await svc.create('ana', { name: 'BCP sueldo', kind: 'bank', institution: 'BCP' })
    await svc.create('beto', { name: 'Efectivo', kind: 'cash', institution: null })
    expect(await svc.list('ana')).toEqual([expect.objectContaining({ id: a.id, name: 'BCP sueldo', kind: 'bank' })])
  })

  it('renames and archives; archived accounts cannot receive movements', async () => {
    const { svc } = setup()
    const a = await svc.create('ana', { name: 'Visa', kind: 'card', institution: null })
    await svc.assertOwned('ana', a.id)
    expect((await svc.update('ana', a.id, { name: 'Visa Interbank', archived: true })).archived).toBe(true)
    await expect(svc.assertOwned('ana', a.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("someone else's account is a 404 for update and for movements", async () => {
    const { svc } = setup()
    const a = await svc.create('ana', { name: 'Yape', kind: 'wallet', institution: null })
    await expect(svc.update('beto', a.id, { name: 'mía' })).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.assertOwned('beto', a.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('reports ACCOUNTS_NOT_READY before migration 019', async () => {
    const { svc } = setup(['accounts'])
    await expect(svc.list('ana')).rejects.toBeInstanceOf(AccountsNotReadyError)
  })

  it('validates input', () => {
    expect(validateAccountInput({ name: ' BCP  ', kind: 'bank', institution: ' BCP ' })).toEqual({ name: 'BCP', kind: 'bank', institution: 'BCP' })
    expect(() => validateAccountInput({ name: '', kind: 'bank' })).toThrow(BadRequestException)
    expect(() => validateAccountInput({ name: 'X', kind: 'crypto' })).toThrow(BadRequestException)
    expect(validateAccountInput({ archived: true }, true)).toEqual({ archived: true })
    expect(() => validateAccountInput({ archived: 'yes' }, true)).toThrow(BadRequestException)
  })
})
