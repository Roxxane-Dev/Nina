import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common'
import { FakeSupabase } from '../testing/fake-supabase'
import { validateSpaceInput } from './spaces.controller'
import { SpacesNotReadyError } from './spaces.errors'
import { SpacesService, generateInviteCode, normalizeInviteCode } from './spaces.service'

const ANA = 'user-ana'
const BETO = 'user-beto'
const CARLA = 'user-carla'

function setup(missing: string[] = []) {
  const db = new FakeSupabase(
    { space_members: ['space_id', 'user_id'], space_invites: ['code'] },
    missing,
  )
  db.rows('profiles').push(
    { id: ANA, full_name: 'Ana Torres', email: 'ana@x.pe' },
    { id: BETO, full_name: null, email: 'beto@x.pe' },
  )
  const svc = new SpacesService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  return { svc, db }
}

function addRow(db: FakeSupabase, id: string, user: string, amount: number, type: string, space: string | null, date = '2026-10-05T00:00:00+00:00') {
  db.rows('transactions').push({ id, user_id: user, type, amount, category: 'home', description: id, date, shared_space_id: space })
}

describe('SpacesService', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-11T15:00:00Z'))
  })
  afterAll(() => jest.useRealTimers())

  it('US-33: creating a space makes the creator its owner', async () => {
    const { svc } = setup()
    const s = await svc.create(ANA, 'Casa', 'pareja')
    expect(s).toEqual(expect.objectContaining({ name: 'Casa', role: 'owner', memberCount: 1 }))
    expect(await svc.listMine(ANA)).toEqual([expect.objectContaining({ id: s.id, role: 'owner' })])
  })

  it('US-34: invite by code and join; joining twice is harmless', async () => {
    const { svc } = setup()
    const s = await svc.create(ANA, 'Casa', 'pareja')
    const { code } = await svc.createInvite(ANA, s.id)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    const joined = await svc.join(BETO, code.toLowerCase().replace(/(.{4})/, '$1 '))
    expect(joined).toEqual(expect.objectContaining({ id: s.id, role: 'member', memberCount: 2 }))
    await svc.join(BETO, code)
    expect((await svc.listMine(BETO))[0].memberCount).toBe(2)
  })

  it('rejects unknown, malformed and expired codes', async () => {
    const { svc, db } = setup()
    const s = await svc.create(ANA, 'Casa', 'pareja')
    await expect(svc.join(BETO, 'ZZZZZZZZ')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.join(BETO, 'abc')).rejects.toBeInstanceOf(BadRequestException)
    db.rows('space_invites').push({ code: 'ABCDEFGH', space_id: s.id, created_by: ANA, expires_at: '2026-10-01T00:00:00Z' })
    await expect(svc.join(BETO, 'ABCDEFGH')).rejects.toBeInstanceOf(GoneException)
  })

  it('outsiders cannot invite, read or see that the space exists', async () => {
    const { svc } = setup()
    const s = await svc.create(ANA, 'Casa', 'pareja')
    await expect(svc.createInvite(CARLA, s.id)).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.overview(CARLA, s.id)).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.transactions(CARLA, s.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('US-36/37/39: the space shows only its rows, with who registered each', async () => {
    const { svc, db } = setup()
    const s = await svc.create(ANA, 'Casa', 'pareja')
    await svc.join(BETO, (await svc.createInvite(ANA, s.id)).code)
    addRow(db, 'alquiler', ANA, 1200, 'expense', s.id)
    addRow(db, 'mercado', BETO, 300.5, 'expense', s.id)
    addRow(db, 'personal-ana', ANA, 80, 'expense', null)
    addRow(db, 'personal-beto', BETO, 45, 'expense', null)

    const o = await svc.overview(BETO, s.id, 'current')
    expect(o.expenses).toBe(1500.5)
    expect(o.members).toEqual([
      expect.objectContaining({ name: 'Ana Torres', expenses: 1200, isMe: false }),
      expect.objectContaining({ name: 'beto', expenses: 300.5, isMe: true }),
    ])
    const list = await svc.transactions(BETO, s.id)
    expect(list.map((t) => t.description).sort()).toEqual(['alquiler', 'mercado'])
    expect(list.find((t) => t.description === 'alquiler')).toEqual(expect.objectContaining({ author: 'Ana Torres', isMine: false }))
  })

  it('US-38: the owner leaves → the oldest member becomes owner; the last one leaving deletes it', async () => {
    const { svc, db } = setup()
    const s = await svc.create(ANA, 'Casa', 'pareja')
    db.rows('space_members')[0].joined_at = '2026-10-01T00:00:00Z'
    await svc.join(BETO, (await svc.createInvite(ANA, s.id)).code)
    db.rows('space_members')[1].joined_at = '2026-10-02T00:00:00Z'

    expect(await svc.leave(ANA, s.id)).toEqual({ deleted: false })
    expect(await svc.listMine(ANA)).toEqual([])
    expect((await svc.listMine(BETO))[0]).toEqual(expect.objectContaining({ role: 'owner', memberCount: 1 }))

    expect(await svc.leave(BETO, s.id)).toEqual({ deleted: true })
    expect(db.rows('spaces')).toEqual([])
  })

  it('without migration 017 it reports SPACES_NOT_READY instead of a generic error', async () => {
    const { svc } = setup(['space_members', 'spaces'])
    await expect(svc.listMine(ANA)).rejects.toBeInstanceOf(SpacesNotReadyError)
  })
})

describe('space input and codes', () => {
  it('validates the space name and type', () => {
    expect(validateSpaceInput({ name: '  Mi   casa ', type: 'familia' })).toEqual({ name: 'Mi casa', type: 'familia' })
    expect(() => validateSpaceInput({ name: '' })).toThrow(BadRequestException)
    expect(() => validateSpaceInput({ name: 'x'.repeat(41) })).toThrow(BadRequestException)
    expect(() => validateSpaceInput({ name: 'Casa', type: 'empresa' })).toThrow(BadRequestException)
  })

  it('codes avoid ambiguous characters and normalize user input', () => {
    for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH')
    expect(normalizeInviteCode('ABCDEFG0')).toBeNull()
  })
})
