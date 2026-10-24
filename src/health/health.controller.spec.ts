import { HealthController, hostOf } from './health.controller'

const controllerWith = (url: string | undefined) => new HealthController({ get: () => url } as never)

describe('GET /health', () => {
  it('reports the Supabase host the server uses and nothing else about the configuration', () => {
    const res = controllerWith('http://127.0.0.1:54321').health()
    expect(res).toEqual({ status: 'ok', supabaseHost: '127.0.0.1' })
  })

  it('works when the URL is missing or malformed', () => {
    expect(controllerWith(undefined).health()).toEqual({ status: 'ok', supabaseHost: null })
    expect(controllerWith('not a url').health()).toEqual({ status: 'ok', supabaseHost: null })
  })

  it('never includes keys or the full URL', () => {
    const body = JSON.stringify(controllerWith('https://abc.supabase.co/auth/v1?apikey=secret').health())
    expect(body).not.toContain('secret')
    expect(body).not.toContain('https://')
  })
})

describe('hostOf', () => {
  it.each([
    ['https://abc.supabase.co', 'abc.supabase.co'],
    ['http://localhost:54321/rest/v1', 'localhost'],
    ['', null],
    [undefined, null],
  ])('%s → %s', (url, host) => {
    expect(hostOf(url)).toBe(host)
  })
})
