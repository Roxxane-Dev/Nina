import { Injectable, UnauthorizedException } from '@nestjs/common'
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
