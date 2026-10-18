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
    return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: false } })
  }
}
