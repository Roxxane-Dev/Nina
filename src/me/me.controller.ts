import { BadRequestException, Body, Controller, Get, Logger, OnModuleInit, Patch, Request, UseFilters, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from '../finance-engine/errors'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

export function validateFullName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 1 || name.length > 60) throw new BadRequestException('El nombre debe tener entre 1 y 60 caracteres.')
  return name
}

/** US-40: the user's profile. Currency is soles only this month (decision 11 Oct). */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/me')
export class MeController implements OnModuleInit {
  private readonly logger = new Logger(MeController.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  @Get()
  async get(@Request() req: AuthedRequest) {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db.from('profiles').select('full_name').eq('id', req.user.id).maybeSingle()
    if (error) {
      this.logger.error(`get failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return { email: req.user.email ?? null, fullName: (data?.full_name as string | null) ?? null, currency: 'PEN' }
  }

  @Patch()
  async update(@Request() req: AuthedRequest, @Body() body: { fullName?: unknown }) {
    const fullName = validateFullName(body?.fullName)
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { error } = await this.db
      .from('profiles')
      .upsert({ id: req.user.id, email: req.user.email ?? null, full_name: fullName }, { onConflict: 'id' })
    if (error) {
      this.logger.error(`update failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return { email: req.user.email ?? null, fullName, currency: 'PEN' }
  }
}
