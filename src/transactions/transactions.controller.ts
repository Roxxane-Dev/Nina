import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { TransactionsService, validateNewTransaction, type NewTransactionInput } from './transactions.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

/** Movimientos: manual entry (US-26) and delete (US-25). userId always from the JWT. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post()
  async create(@Request() req: AuthedRequest, @Body() body: Partial<NewTransactionInput>) {
    const v = validateNewTransaction(body ?? {}, this.transactions.today())
    if (!v.ok) throw new BadRequestException(v.error)
    return this.transactions.create(req.user.id, v.value)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Request() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const removed = await this.transactions.remove(req.user.id, id)
    if (!removed) throw new NotFoundException('transaction not found')
  }
}
