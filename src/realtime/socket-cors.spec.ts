import { AllowlistIoAdapter, parseAllowedOrigins } from './socket-cors'

describe('parseAllowedOrigins', () => {
  it('splits, trims and drops trailing slashes', () => {
    expect(parseAllowedOrigins(' https://app.nina.pe/ , http://localhost:3000 ')).toEqual([
      'https://app.nina.pe',
      'http://localhost:3000',
    ])
  })

  it.each([undefined, null, '', '  ,  '])('empty input %p means no browser origin is allowed', (raw) => {
    expect(parseAllowedOrigins(raw)).toEqual([])
  })

  it('never accepts a bare wildcard', () => {
    expect(parseAllowedOrigins('*')).toEqual([])
    expect(parseAllowedOrigins('*, https://app.nina.pe')).toEqual(['https://app.nina.pe'])
  })
})

describe('AllowlistIoAdapter', () => {
  const appWith = (value?: string) =>
    ({ get: () => ({ get: () => value }), getHttpServer: () => ({}) }) as never

  it('hands the allowlist to socket.io (never "*")', () => {
    const adapter = new AllowlistIoAdapter(appWith('https://app.nina.pe'))
    const create = jest.spyOn(Object.getPrototypeOf(AllowlistIoAdapter.prototype), 'createIOServer').mockReturnValue({} as never)
    adapter.createIOServer(3000, {} as never)
    const options = create.mock.calls[0][1] as { cors: { origin: (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => void } }
    const decide = (origin: string) => { let r: boolean | undefined; options.cors.origin(origin, (_e, ok) => { r = ok }); return r }
    expect(decide('https://app.nina.pe')).toBe(true)
    expect(decide('https://evil.example.com')).toBe(false)
    create.mockRestore()
  })

  it('with nothing configured (development) loopback is allowed', () => {
    const adapter = new AllowlistIoAdapter(appWith(undefined))
    const create = jest.spyOn(Object.getPrototypeOf(AllowlistIoAdapter.prototype), 'createIOServer').mockReturnValue({} as never)
    adapter.createIOServer(3000, {} as never)
    const origin = (create.mock.calls[0][1] as { cors: { origin: (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => void } }).cors.origin
    let allowed: boolean | undefined
    origin('http://localhost:3000', (_e, ok) => { allowed = ok })
    expect(allowed).toBe(true) // development default: loopback is allowed when nothing is configured
    create.mockRestore()
  })
})
