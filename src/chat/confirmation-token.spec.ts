import { ConfirmationTokens, PENDING_TTL_MS, confirmationSecret } from './confirmation-token'

describe('ConfirmationTokens', () => {
  const tokens = new ConfirmationTokens('test-secret')
  const action = { kind: 'income' as const, payload: { income: { amount: 4500, category: 'salary' } } }

  it('round-trips for the same user', () => {
    const t = tokens.sign('user-a', action, 1000)
    expect(tokens.verify(t, 'user-a', 2000)).toEqual(action)
  })

  it('rejects another user', () => {
    const t = tokens.sign('user-a', action, 1000)
    expect(tokens.verify(t, 'user-b', 2000)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const t = tokens.sign('user-a', action, 1000)
    const [, mac] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ ...action, payload: { income: { amount: 999999 } }, sub: 'user-a', exp: 9e15 })).toString('base64url')
    expect(tokens.verify(`${forged}.${mac}`, 'user-a', 2000)).toBeNull()
  })

  it('expires', () => {
    const t = tokens.sign('user-a', action, 1000)
    expect(tokens.verify(t, 'user-a', 1000 + PENDING_TTL_MS + 1)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(tokens.verify('nope', 'user-a')).toBeNull()
    expect(tokens.verify(undefined, 'user-a')).toBeNull()
  })

  it('derives a secret from the service role key when none is set', () => {
    const s = confirmationSecret({ SUPABASE_SERVICE_ROLE_KEY: 'k' })
    expect(s).toHaveLength(64)
    expect(s).not.toContain('k')
  })
})
