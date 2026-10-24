import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Public liveness check. It touches no user data and is the one controller without the JWT guard.
 * `supabaseHost` is the host of the Supabase project this server validates tokens against, so the
 * app can tell the user when it was started with a different project (a classic dev setup mistake
 * that otherwise looks like "I log in and get thrown back to the login").
 */
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  health() {
    return { status: 'ok', supabaseHost: hostOf(this.config.get<string>('SUPABASE_URL')) }
  }
}

export function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname : null
  } catch {
    return null
  }
}
