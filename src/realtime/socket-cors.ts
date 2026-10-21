import { INestApplicationContext, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { ServerOptions } from 'socket.io'

/**
 * Origins allowed to open the WebSocket from a browser, from the env variable
 * CORS_ALLOWED_ORIGINS (comma-separated, e.g. "https://app.nina.pe,http://localhost:3000").
 *
 * Native mobile clients send no Origin header and are not affected. When the
 * variable is empty or unset, browsers from other origins are refused. A bare
 * "*" is ignored on purpose: list the origins explicitly.
 */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0 && o !== '*')
}

/**
 * CORS options for the HTTP API, from the same allowlist as the WebSocket.
 * An empty list turns CORS off (no Access-Control-* headers), so browsers on
 * other origins are refused; native clients send no Origin and are unaffected.
 */
export function httpCorsOptions(origins: string[]) {
  return {
    origin: origins.length > 0 ? origins : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
}

/**
 * Browsers do not apply CORS to WebSocket connections, so the `cors` option alone
 * does not stop a page on another origin from connecting with transport "websocket".
 * The server must check the Origin header itself. No Origin header (native clients,
 * server-to-server) is allowed; a present Origin must be in the allowlist.
 */
export function isOriginAllowed(origin: string | undefined | null, allowed: string[]): boolean {
  if (!origin) return true
  return allowed.includes(origin.trim().replace(/\/+$/, ''))
}

/** Socket.IO adapter that applies the allowlist at runtime (after ConfigModule has loaded). */
export class AllowlistIoAdapter extends IoAdapter {
  private readonly logger = new Logger(AllowlistIoAdapter.name)
  private readonly origins: string[]

  constructor(app: INestApplicationContext) {
    super(app)
    this.origins = parseAllowedOrigins(app.get(ConfigService).get<string>('CORS_ALLOWED_ORIGINS'))
    if (this.origins.length === 0) {
      this.logger.warn('CORS_ALLOWED_ORIGINS is empty: browsers on other origins cannot open the WebSocket')
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: false },
      // Covers the websocket transport, which CORS does not (see isOriginAllowed).
      allowRequest: (req: { headers: { origin?: string } }, callback: (err: string | null | undefined, success: boolean) => void) => {
        const origin = req.headers.origin
        if (isOriginAllowed(origin, this.origins)) return callback(null, true)
        this.logger.warn('WebSocket connection refused: Origin not in CORS_ALLOWED_ORIGINS')
        return callback('Origin not allowed', false)
      },
    })
  }
}
