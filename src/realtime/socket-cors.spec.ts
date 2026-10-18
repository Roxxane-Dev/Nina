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
    const options = create.mock.calls[0][1] as { cors: { origin: unknown } }
    expect(options.cors.origin).toEqual(['https://app.nina.pe'])
    create.mockRestore()
  })

  it('with nothing configured no origin is allowed', () => {
    const adapter = new AllowlistIoAdapter(appWith(undefined))
    const create = jest.spyOn(Object.getPrototypeOf(AllowlistIoAdapter.prototype), 'createIOServer').mockReturnValue({} as never)
    adapter.createIOServer(3000, {} as never)
    expect((create.mock.calls[0][1] as { cors: { origin: unknown } }).cors.origin).toEqual([])
    create.mockRestore()
  })
})
