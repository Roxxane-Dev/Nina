import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { SpacesService, type SpaceType } from './spaces.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

const TYPES: SpaceType[] = ['pareja', 'familia', 'otro']

export function validateSpaceInput(body: { name?: unknown; type?: unknown }): { name: string; type: SpaceType } {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 1 || name.length > 40) throw new BadRequestException('El nombre debe tener entre 1 y 40 caracteres.')
  const type = (typeof body?.type === 'string' ? body.type : 'pareja') as SpaceType
  if (!TYPES.includes(type)) throw new BadRequestException("type must be 'pareja', 'familia' or 'otro'")
  return { name, type }
}

/** Shared spaces (US-33 to US-38). userId always from the JWT; membership checked per call. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get()
  async list(@Request() req: AuthedRequest) {
    return { spaces: await this.spaces.listMine(req.user.id) }
  }

  @Post()
  async create(@Request() req: AuthedRequest, @Body() body: { name?: unknown; type?: unknown }) {
    const { name, type } = validateSpaceInput(body)
    return this.spaces.create(req.user.id, name, type)
  }

  @Post('join')
  async join(@Request() req: AuthedRequest, @Body() body: { code?: string }) {
    return this.spaces.join(req.user.id, body?.code ?? '')
  }

  @Post(':id/invites')
  async invite(@Request() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.spaces.createInvite(req.user.id, id)
  }

  @Delete(':id/membership')
  async leave(@Request() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.spaces.leave(req.user.id, id)
  }

  @Get(':id/overview')
  async overview(
    @Request() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('period') period?: string,
  ) {
    return this.spaces.overview(req.user.id, id, period)
  }

  @Get(':id/transactions')
  async transactions(@Request() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return { transactions: await this.spaces.transactions(req.user.id, id) }
  }
}
