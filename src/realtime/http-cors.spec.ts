import { Controller, Get, INestApplication, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { httpCorsOptions, parseAllowedOrigins } from './socket-cors'

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true }
  }
}

@Module({ controllers: [PingController] })
class PingModule {}

async function appWith(rawOrigins: string | undefined) {
  const app: INestApplication = await NestFactory.create(PingModule, { logger: false })
  app.enableCors(httpCorsOptions(parseAllowedOrigins(rawOrigins)))
  await app.listen(0, '127.0.0.1')
  const url = await app.getUrl()
  return { app, url: url.replace('[::1]', '127.0.0.1') }
}

describe('httpCorsOptions', () => {
  it('turns CORS off when the allowlist is empty', () => {
    expect(httpCorsOptions([]).origin).toBe(false)
  })

  it('uses the explicit list, never a wildcard', () => {
    expect(httpCorsOptions(['https://app.nina.pe']).origin).toEqual(['https://app.nina.pe'])
    expect(httpCorsOptions(parseAllowedOrigins('*')).origin).toBe(false)
  })
})

describe('HTTP CORS over a real request', () => {
  it('empty allowlist: a browser origin gets no CORS headers (and no wildcard)', async () => {
    const { app, url } = await appWith(undefined)
    try {
      const res = await fetch(`${url}/ping`, { headers: { Origin: 'https://evil.example.com' } })
      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
      const pre = await fetch(`${url}/ping`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'GET' },
      })
      expect(pre.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('an allowed origin is echoed back; another origin is not', async () => {
    const { app, url } = await appWith('https://app.nina.pe, http://localhost:3000')
    try {
      const ok = await fetch(`${url}/ping`, { headers: { Origin: 'https://app.nina.pe' } })
      expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.nina.pe')
      const other = await fetch(`${url}/ping`, { headers: { Origin: 'https://evil.example.com' } })
      expect(other.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('native clients (no Origin header) are unaffected', async () => {
    const { app, url } = await appWith(undefined)
    try {
      const res = await fetch(`${url}/ping`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
    } finally {
      await app.close()
    }
  })
})
