import { BadRequestException } from '@nestjs/common'
import { FakeSupabase } from '../testing/fake-supabase'
import { ConsentsController } from './consents.controller'
import { ConsentsNotReadyError, ConsentsService, POLICY_VERSION } from './consents.service'
import { validateFullName } from '../me/me.controller'

function setup(missing: string[] = []) {
  const db = new FakeSupabase({}, missing)
  const svc = new ConsentsService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  return { svc, db }
}

describe('Consents (US-03 / US-42)', () => {
  let clock = 0
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-11T10:00:00Z'))
  })
  afterEach(() => jest.useRealTimers())

  // FakeSupabase has no default for created_at: stamp rows so "latest" is well defined.
  function stamp(db: FakeSupabase) {
    for (const r of db.rows('consents')) r.created_at ??= new Date(Date.now() + clock++).toISOString()
  }

  it('a new user has answered nothing and AI is off', async () => {
    const { svc } = setup()
    expect(await svc.current('u1')).toEqual({
      policyVersion: POLICY_VERSION,
      answered: false,
      available: true,
      consents: { data_processing: false, ai_processing: false, analytics: false },
    })
    expect(await svc.allowsAi('u1')).toBe(false)
  })

  it('records the first answer for every purpose, then only changes (append-only log)', async () => {
    const { svc, db } = setup()
    await svc.record('u1', { data_processing: true, ai_processing: true, analytics: false })
    stamp(db)
    expect(db.rows('consents')).toHaveLength(3)
    expect(await svc.allowsAi('u1')).toBe(true)

    await svc.record('u1', { data_processing: true, ai_processing: false, analytics: false })
    stamp(db)
    expect(db.rows('consents')).toHaveLength(4) // only ai_processing changed
    expect((await svc.current('u1')).consents).toEqual({ data_processing: true, ai_processing: false, analytics: false })
    expect(await svc.allowsAi('u1')).toBe(false)
  })

  it('policy 2026-10-v2 (D-014): a consent given under the previous text does not count until answered again', async () => {
    expect(POLICY_VERSION).toBe('2026-10-v2')
    const { svc, db } = setup()
    // The user said yes to everything under v1.
    db.rows('consents').push(
      { user_id: 'u1', purpose: 'data_processing', granted: true, policy_version: '2026-10-v1' },
      { user_id: 'u1', purpose: 'ai_processing', granted: true, policy_version: '2026-10-v1' },
    )
    stamp(db)
    const before = await svc.current('u1')
    expect(before.answered).toBe(false) // the app shows the consent screen again
    expect(await svc.allowsAi('u1')).toBe(false) // and no LLM meanwhile

    // Answering again with the same choices records them under v2 (append-only).
    await svc.record('u1', { data_processing: true, ai_processing: true, analytics: false })
    stamp(db)
    const v2 = db.rows('consents').filter((r) => r.policy_version === '2026-10-v2')
    expect(v2.map((r) => r.purpose).sort()).toEqual(['ai_processing', 'analytics', 'data_processing'])
    expect(db.rows('consents').filter((r) => r.policy_version === '2026-10-v1')).toHaveLength(2) // history kept
    expect((await svc.current('u1')).answered).toBe(true)
    expect(await svc.allowsAi('u1')).toBe(true)

    // Saying no to AI under v2 keeps it off.
    await svc.record('u1', { data_processing: true, ai_processing: false, analytics: false })
    stamp(db)
    expect(await svc.allowsAi('u1')).toBe(false)
  })

  it('AI needs both data and AI consent', async () => {
    const { svc, db } = setup()
    await svc.record('u1', { data_processing: false, ai_processing: true })
    stamp(db)
    expect(await svc.allowsAi('u1')).toBe(false)
  })

  it('before migration 018 the app stays usable but AI is off and nothing can be stored', async () => {
    const { svc } = setup(['consents'])
    const s = await svc.current('u1')
    expect(s).toEqual(expect.objectContaining({ answered: true, available: false }))
    expect(s.consents.data_processing).toBe(true)
    expect(await svc.allowsAi('u1')).toBe(false)
    await expect(svc.record('u1', { ai_processing: true })).rejects.toBeInstanceOf(ConsentsNotReadyError)
  })

  it('rejects unknown purposes and non-boolean values', async () => {
    const ctrl = new ConsentsController(setup().svc)
    const req = { user: { id: 'u1' } } as never
    await expect(ctrl.post(req, { marketing: true })).rejects.toBeInstanceOf(BadRequestException)
    await expect(ctrl.post(req, { ai_processing: 'yes' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(ctrl.post(req, {})).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('profile name (US-40)', () => {
  it('validates and normalizes', () => {
    expect(validateFullName('  Ana   Torres ')).toBe('Ana Torres')
    expect(() => validateFullName('')).toThrow(BadRequestException)
    expect(() => validateFullName('x'.repeat(61))).toThrow(BadRequestException)
  })
})
