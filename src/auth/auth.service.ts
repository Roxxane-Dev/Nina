import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseUser {
  id: string
  email: string | undefined
}

@Injectable()
export class AuthService {
  private readonly supabase: SupabaseClient

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL')
    const anonKey = this.config.getOrThrow<string>('SUPABASE_ANON_KEY')
    this.supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  /**
   * Validates a Supabase access token and returns the decoded user payload.
   * Throws UnauthorizedException when the token is missing, expired, or invalid.
   */
  async validateToken(token: string): Promise<SupabaseUser> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token)

    // The auth server could not be reached (restart, network): that is not an invalid token.
    // 503 lets the client retry instead of treating it as a logout.
    if (error && isTransportError(error)) {
      throw new ServiceUnavailableException('Auth service unavailable')
    }

    if (error || !user) {
      throw new UnauthorizedException(
        error?.message ?? 'Invalid or expired token',
      )
    }

    return {
      id: user.id,
      email: user.email,
    }
  }
}

/** supabase-js reports unreachable servers as AuthRetryableFetchError (status 0) or a "fetch failed" message. */
export function isTransportError(error: { name?: string; status?: number; message?: string }): boolean {
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    (error.status === undefined && /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network/i.test(error.message ?? ''))
  )
}
