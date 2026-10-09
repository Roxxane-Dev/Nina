import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { AuthService, type SupabaseUser } from './auth.service'

type AuthenticatedRequest = Request & { user: SupabaseUser }

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>()
    const token = this.extractBearerToken(request)

    if (!token) {
      throw new UnauthorizedException('Missing Authorization header')
    }

    // Validate and attach user — never trust a client-provided userId
    request.user = await this.authService.validateToken(token)
    return true
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }
    return authHeader.slice(7).trim() || null
  }
}
