import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { CATEGORY_LABELS_ES, categoryLabel, normalizeCategorySlug } from '../../packages/finance-engine/src'
import { CategoryRulesService } from '../category-rules/category-rules.service'
import { TransactionsService, validateNewTransaction, type NewTransactionInput } from './transactions.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

/** Movimientos: manual entry (US-26), category correction (US-24) and delete (US-25). userId always from the JWT. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly rules: CategoryRulesService,
  ) {}

  @Post()
  async create(@Request() req: AuthedRequest, @Body() body: Partial<NewTransactionInput>) {
    const v = validateNewTransaction(body ?? {}, this.transactions.today())
    if (!v.ok) throw new BadRequestException(v.error)
    return this.transactions.create(req.user.id, v.value)
  }

  /** US-24: fix the category and remember it for similar descriptions. */
  @Patch(':id')
  async updateCategory(
    @Request() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { category?: string },
  ) {
    const raw = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : ''
    const slug = normalizeCategorySlug(raw)
    if (!raw || !CATEGORY_LABELS_ES[slug] || (slug === 'other' && raw !== 'other' && raw !== 'otros')) {
      throw new BadRequestException('unknown category')
    }
    const row = await this.transactions.updateCategory(req.user.id, id, slug)
    if (!row) throw new NotFoundException('transaction not found')
    const remembered = row.type === 'expense' && row.description
      ? await this.rules.remember(req.user.id, row.description, slug)
      : false
    return { id, category: slug, label: categoryLabel(slug), remembered }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Request() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const removed = await this.transactions.remove(req.user.id, id)
    if (!removed) throw new NotFoundException('transaction not found')
  }
}
