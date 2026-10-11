import { BadRequestException, Body, Controller, Get, Post, Request, UseFilters, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { CONSENT_PURPOSES, ConsentsService, type ConsentPurpose } from './consents.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

/** US-03 / US-42: read and change consents. userId always from the JWT. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/consents')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get()
  async get(@Request() req: AuthedRequest) {
    return this.consents.current(req.user.id)
  }

  @Post()
  async post(@Request() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const choices: Partial<Record<ConsentPurpose, boolean>> = {}
    for (const [key, value] of Object.entries(body ?? {})) {
      if (!(CONSENT_PURPOSES as readonly string[]).includes(key) || typeof value !== 'boolean') {
        throw new BadRequestException(`unknown consent '${key}' or non-boolean value`)
      }
      choices[key as ConsentPurpose] = value
    }
    if (!Object.keys(choices).length) throw new BadRequestException('no consents given')
    return this.consents.record(req.user.id, choices)
  }
}
