import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseFilters, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { AccountsService, validateAccountInput, type AccountInput } from './accounts.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

/** US-41: the user's accounts. userId always from the JWT. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async list(@Request() req: AuthedRequest) {
    return { accounts: await this.accounts.list(req.user.id) }
  }

  @Post()
  async create(@Request() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    return this.accounts.create(req.user.id, validateAccountInput(body ?? {}) as AccountInput)
  }

  /** Rename, change kind/institution, or archive / unarchive. */
  @Patch(':id')
  async update(
    @Request() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accounts.update(req.user.id, id, validateAccountInput(body ?? {}, true))
  }
}
