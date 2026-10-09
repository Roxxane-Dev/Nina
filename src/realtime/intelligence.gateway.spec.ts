import { IntelligenceGateway, userRoom } from './intelligence.gateway'
import type { AuthService } from '../auth/auth.service'

function fakeSocket(handshake: Record<string, unknown>) {
  return {
    id: 'sock-1',
    handshake: { auth: {}, headers: {}, query: {}, ...handshake },
    data: {} as Record<string, unknown>,
    join: jest.fn(),
    disconnect: jest.fn(),
  }
}

describe('IntelligenceGateway', () => {
  const auth = {
    validateToken: jest.fn(async (token: string) => {
      if (token === 'good') return { id: 'user-a', email: undefined }
      throw new Error('invalid')
    }),
  } as unknown as AuthService

  it('joins the room of the user from the validated token', async () => {
    const gw = new IntelligenceGateway(auth)
    const s = fakeSocket({ auth: { token: 'good' } })
    await gw.handleConnection(s as never)
    expect(s.join).toHaveBeenCalledWith(userRoom('user-a'))
    expect(s.disconnect).not.toHaveBeenCalled()
  })

  it('ignores a client-supplied userId and disconnects without a token', async () => {
    const gw = new IntelligenceGateway(auth)
    const s = fakeSocket({ query: { userId: 'user-b' } })
    await gw.handleConnection(s as never)
    expect(s.join).not.toHaveBeenCalled()
    expect(s.disconnect).toHaveBeenCalledWith(true)
  })

  it('disconnects when the token is invalid', async () => {
    const gw = new IntelligenceGateway(auth)
    const s = fakeSocket({ headers: { authorization: 'Bearer bad' } })
    await gw.handleConnection(s as never)
    expect(s.join).not.toHaveBeenCalled()
    expect(s.disconnect).toHaveBeenCalledWith(true)
  })

  it('emits events only to the owning user room', () => {
    const gw = new IntelligenceGateway(auth)
    const emit = jest.fn()
    const to = jest.fn(() => ({ emit }))
    gw.server = { to } as never
    gw.handleFinancialEvent({ type: 'x', userId: 'user-a' } as never)
    expect(to).toHaveBeenCalledWith(userRoom('user-a'))
    expect(emit).toHaveBeenCalledWith('intelligence_update', expect.anything())
  })
})
