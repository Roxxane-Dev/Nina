import { INestApplication, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { WebSocketGateway } from '@nestjs/websockets'
import WebSocket from 'ws'
import { AllowlistIoAdapter, isOriginAllowed } from './socket-cors'

@WebSocketGateway({ namespace: 'intelligence' })
class TestGateway {
  handleConnection() {
    /* accept; the real gateway authenticates the token here */
  }
}

async function appWith(allowlist: string) {
  @Module({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, load: [() => ({ CORS_ALLOWED_ORIGINS: allowlist })] })],
    providers: [TestGateway],
  })
  class TestModule {}
  const app: INestApplication = await NestFactory.create(TestModule, { logger: false })
  app.useWebSocketAdapter(new AllowlistIoAdapter(app))
  await app.listen(0, '127.0.0.1')
  const port = Number(new URL((await app.getUrl()).replace('[::1]', '127.0.0.1')).port)
  return { app, port }
}

/** Opens the websocket transport; resolves 'connected' or the HTTP status that refused it. */
function open(port: number, origin?: string): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers: origin ? { Origin: origin } : {} })
    ws.on('message', (data) => {
      if (data.toString().startsWith('0')) {
        ws.close()
        resolve('connected')
      }
    })
    ws.on('unexpected-response', (_req, res) => {
      resolve(`refused ${res.statusCode}`)
      ws.terminate()
    })
    ws.on('error', () => undefined)
    setTimeout(() => resolve('timeout'), 3000)
  })
}

describe('isOriginAllowed', () => {
  it('allows requests without an Origin header (native clients)', () => {
    expect(isOriginAllowed(undefined, [])).toBe(true)
    expect(isOriginAllowed(null, ['https://app.nina.pe'])).toBe(true)
  })

  it('requires a present Origin to be listed (trailing slash ignored)', () => {
    expect(isOriginAllowed('https://app.nina.pe', ['https://app.nina.pe'])).toBe(true)
    expect(isOriginAllowed('https://app.nina.pe/', ['https://app.nina.pe'])).toBe(true)
    expect(isOriginAllowed('https://evil.example.com', ['https://app.nina.pe'])).toBe(false)
    expect(isOriginAllowed('https://evil.example.com', [])).toBe(false)
  })
})

describe('WebSocket transport honours the allowlist (CORS alone does not)', () => {
  it('refuses a browser Origin that is not listed', async () => {
    const { app, port } = await appWith('https://app.nina.pe')
    try {
      expect(await open(port, 'https://evil.example.com')).toMatch(/^refused (400|403)$/)
    } finally {
      await app.close()
    }
  })

  it('accepts a listed Origin and a connection with no Origin', async () => {
    const { app, port } = await appWith('https://app.nina.pe')
    try {
      expect(await open(port, 'https://app.nina.pe')).toBe('connected')
      expect(await open(port)).toBe('connected')
    } finally {
      await app.close()
    }
  })

  it('with an empty allowlist every browser Origin is refused, native still connects', async () => {
    const { app, port } = await appWith('')
    try {
      expect(await open(port, 'http://localhost:3000')).toMatch(/^refused (400|403)$/)
      expect(await open(port)).toBe('connected')
    } finally {
      await app.close()
    }
  })
})
