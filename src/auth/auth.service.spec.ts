import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { AuthService, isTransportError } from './auth.service'

const getUser = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: (...args: unknown[]) => getUser(...args) } }),
}))

const config = { getOrThrow: () => 'http://127.0.0.1:54321' } as never

describe('AuthService.validateToken', () => {
  beforeEach(() => getUser.mockReset())

  it('returns the user for a valid token', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@nina.test' } }, error: null })
    await expect(new AuthService(config).validateToken('t')).resolves.toEqual({ id: 'u1', email: 'a@nina.test' })
  })

  it('an invalid or expired token is 401', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } })
    await expect(new AuthService(config).validateToken('bad')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('an unreachable auth server is 503, not 401 (the app must not treat it as a logout)', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } })
    await expect(new AuthService(config).validateToken('t')).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})

describe('isTransportError', () => {
  it.each([
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'x' }, true],
    [{ status: 0, message: 'x' }, true],
    [{ message: 'fetch failed' }, true],
    [{ message: 'read ECONNRESET' }, true],
    [{ name: 'AuthApiError', status: 401, message: 'invalid JWT' }, false],
    [{ name: 'AuthApiError', status: 403, message: 'forbidden' }, false],
    [{ status: 400, message: 'bad request' }, false],
  ])('%j → %s', (err, expected) => {
    expect(isTransportError(err)).toBe(expected)
  })
})
