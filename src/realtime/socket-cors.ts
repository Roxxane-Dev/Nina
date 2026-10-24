import { INestApplicationContext, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { ServerOptions } from 'socket.io'

/**
 * Origins allowed to call the API or open the WebSocket from a browser, from the
 * env variable CORS_ALLOWED_ORIGINS (comma-separated, e.g.
 * "https://app.nina.pe,http://localhost:*"). An entry may end in ":*" to accept any
 * port on that host (Flutter web picks a random port in development).
 *
 * Native mobile clients send no Origin header and are not affected. A bare "*" is
 * ignored on purpose: list the origins explicitly.
 */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0 && o !== '*')
}

/** Loopback origins on any port: the developer's own machine, used when nothing is configured. */
export const DEV_LOOPBACK_ORIGINS = ['http://localhost:*', 'http://127.0.0.1:*', 'http://[::1]:*']

/**
 * The effective allowlist. With CORS_ALLOWED_ORIGINS set, exactly that list. With it
 * empty: no browser origin when NODE_ENV is "production", otherwise the loopback
 * origins above, so `flutter run -d chrome` works without extra setup.
 */
export function resolveAllowedOrigins(raw: string | undefined | null, nodeEnv: string | undefined | null): string[] {
  const listed = parseAllowedOrigins(raw)
  if (listed.length > 0) return listed
  return nodeEnv === 'production' ? [] : [...DEV_LOOPBACK_ORIGINS]
}

function originMatches(origin: string, entry: string): boolean {
  if (entry.endsWith(':*')) {
    const prefix = entry.slice(0, -1) // keeps "scheme://host:"
    if (!origin.startsWith(prefix)) return false
    return /^\d{1,5}$/.test(origin.slice(prefix.length))
  }
  return origin === entry
}

/**
 * Browsers do not apply CORS to WebSocket connections, so the `cors` option alone
 * does not stop a page on another origin from connecting with transport "websocket".
 * The server must check the Origin header itself. No Origin header (native clients,
 * server-to-server) is allowed; a present Origin must match the allowlist.
 */
export function isOriginAllowed(origin: string | undefined | null, allowed: string[]): boolean {
  if (!origin) return true
  const clean = origin.trim().replace(/\/+$/, '')
  return allowed.some((entry) => originMatches(clean, entry))
}

type OriginCallback = (err: Error | null, allow?: boolean) => void

/** `origin` callback shared by the HTTP CORS middleware and Socket.IO. */
export function originChecker(allowed: string[]) {
  return (origin: string | undefined, callback: OriginCallback) => callback(null, isOriginAllowed(origin, allowed))
}

/**
 * CORS options for the HTTP API, from the same allowlist as the WebSocket.
 * An empty list turns CORS off (no Access-Control-* headers), so browsers on
 * other origins are refused; native clients send no Origin and are unaffected.
 */
export function httpCorsOptions(origins: string[]) {
  return {
    origin: origins.length > 0 ? originChecker(origins) : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
}

/** Socket.IO adapter that applies the allowlist at runtime (after ConfigModule has loaded). */
export class AllowlistIoAdapter extends IoAdapter {
  private readonly logger = new Logger(AllowlistIoAdapter.name)
  private readonly origins: string[]

  constructor(app: INestApplicationContext) {
    super(app)
    const config = app.get(ConfigService)
    this.origins = resolveAllowedOrigins(
      config.get<string>('CORS_ALLOWED_ORIGINS'),
      config.get<string>('NODE_ENV') ?? process.env.NODE_ENV,
    )
    if (this.origins.length === 0) {
      this.logger.warn('CORS_ALLOWED_ORIGINS is empty and NODE_ENV=production: browsers on other origins cannot open the WebSocket')
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: originChecker(this.origins), credentials: false },
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
