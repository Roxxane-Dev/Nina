import { DEV_LOOPBACK_ORIGINS, isOriginAllowed, originChecker, resolveAllowedOrigins } from './socket-cors'

describe('resolveAllowedOrigins', () => {
  it('uses exactly the configured list when there is one (even in development)', () => {
    expect(resolveAllowedOrigins('https://app.nina.pe', 'development')).toEqual(['https://app.nina.pe'])
    expect(resolveAllowedOrigins('https://app.nina.pe', 'production')).toEqual(['https://app.nina.pe'])
  })

  it('empty + production: no browser origin', () => {
    expect(resolveAllowedOrigins('', 'production')).toEqual([])
    expect(resolveAllowedOrigins(undefined, 'production')).toEqual([])
    expect(resolveAllowedOrigins('*', 'production')).toEqual([]) // a bare * is ignored
  })

  it('empty + anything else: loopback origins so Flutter web works in development', () => {
    expect(resolveAllowedOrigins('', undefined)).toEqual(DEV_LOOPBACK_ORIGINS)
    expect(resolveAllowedOrigins(undefined, 'development')).toEqual(DEV_LOOPBACK_ORIGINS)
    expect(resolveAllowedOrigins('', 'test')).toEqual(DEV_LOOPBACK_ORIGINS)
  })
})

describe('isOriginAllowed with port wildcards', () => {
  const dev = DEV_LOOPBACK_ORIGINS

  it.each([
    'http://localhost:5050',
    'http://localhost:3000',
    'http://127.0.0.1:61234',
    'http://[::1]:8080',
  ])('accepts loopback %s', (origin) => {
    expect(isOriginAllowed(origin, dev)).toBe(true)
  })

  it.each([
    'https://localhost:5050', // other scheme
    'http://localhost', // no port
    'http://localhost:abc',
    'http://localhost:5050.evil.com',
    'http://localhost.evil.com:5050',
    'http://evil.example.com:5050',
    'http://127.0.0.1.evil.com:80',
  ])('rejects look-alike %s', (origin) => {
    expect(isOriginAllowed(origin, dev)).toBe(false)
  })

  it('a wildcard entry only applies to its own host', () => {
    expect(isOriginAllowed('https://app.nina.pe:8443', ['https://app.nina.pe:*'])).toBe(true)
    expect(isOriginAllowed('https://other.nina.pe:8443', ['https://app.nina.pe:*'])).toBe(false)
  })

  it('exact entries still match exactly', () => {
    expect(isOriginAllowed('https://app.nina.pe', ['https://app.nina.pe'])).toBe(true)
    expect(isOriginAllowed('https://app.nina.pe:444', ['https://app.nina.pe'])).toBe(false)
  })

  it('no Origin header (native clients) is always allowed', () => {
    expect(isOriginAllowed(undefined, [])).toBe(true)
  })
})

describe('originChecker', () => {
  it('feeds the result to the callback', () => {
    const check = originChecker(DEV_LOOPBACK_ORIGINS)
    let r: boolean | undefined
    check('http://localhost:5050', (_e, ok) => { r = ok })
    expect(r).toBe(true)
    check('https://evil.example.com', (_e, ok) => { r = ok })
    expect(r).toBe(false)
  })
})
