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
import {
  CATEGORY_LABELS_ES,
  categoryLabel,
  duplicateLines,
  normalizeCategorySlug,
  parseCsvStatement,
  type CsvRow,
} from '../../packages/finance-engine/src'
import { CategoryRulesService } from '../category-rules/category-rules.service'
import { SpacesService } from '../spaces/spaces.service'
import { AccountsService } from '../accounts/accounts.service'
import { TransactionsService, validateNewTransaction, validateTransactionEdit, type NewTransactionInput } from './transactions.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

const CSV_ERRORS = {
  empty: 'El archivo está vacío.',
  no_header: 'No encontré las columnas de fecha y monto. ¿Es el CSV de tu banco?',
  too_large: 'El archivo es muy grande: prueba con un periodo más corto.',
}

/** Movimientos: manual entry (US-26), category correction (US-24) and delete (US-25). userId always from the JWT. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly rules: CategoryRulesService,
    private readonly spaces: SpacesService,
    private readonly accounts: AccountsService,
  ) {}

  @Post()
  async create(@Request() req: AuthedRequest, @Body() body: Partial<NewTransactionInput> & { spaceId?: string; accountId?: string }) {
    const v = validateNewTransaction(body ?? {}, this.transactions.today())
    if (!v.ok) throw new BadRequestException(v.error)
    let spaceId: string | undefined
    if (body?.spaceId !== undefined && body.spaceId !== null) {
      if (typeof body.spaceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.spaceId)) throw new BadRequestException('invalid spaceId')
      await this.spaces.assertMember(req.user.id, body.spaceId) // 404 if not a member (US-35)
      spaceId = body.spaceId
    }
    let accountId: string | undefined
    if (body?.accountId !== undefined && body.accountId !== null) {
      if (typeof body.accountId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.accountId)) {
        throw new BadRequestException('invalid accountId')
      }
      await this.accounts.assertOwned(req.user.id, body.accountId) // US-41: only own, active accounts
      accountId = body.accountId
    }
    return this.transactions.create(req.user.id, v.value, spaceId, accountId)
  }

  /** Reads the file and marks what is already registered. Both steps below use it: the server never trusts rows from the client. */
  private async readCsv(userId: string, csv: unknown) {
    if (typeof csv !== 'string') throw new BadRequestException('Falta el archivo.')
    const parsed = parseCsvStatement(csv, { today: this.transactions.today(), rules: await this.rules.listForUser(userId) })
    if (!parsed.ok) throw new BadRequestException(CSV_ERRORS[parsed.error])
    const days = parsed.rows.map((r) => r.date).sort()
    const existing = days.length ? await this.transactions.existingBetween(userId, days[0], days[days.length - 1]) : []
    return { ...parsed, duplicates: duplicateLines(parsed.rows, existing) }
  }

  /** DATA-01: what the file holds. Nothing is saved. */
  @Post('import/preview')
  @HttpCode(200)
  async previewImport(@Request() req: AuthedRequest, @Body() body: { csv?: unknown }) {
    const { rows, skipped, assumedExpenses, duplicates } = await this.readCsv(req.user.id, body?.csv)
    return {
      rows: rows.map((r: CsvRow) => ({ ...r, categoryLabel: categoryLabel(r.category), duplicate: duplicates.has(r.line) })),
      skipped,
      assumedExpenses,
    }
  }

  /** DATA-01: saves the file's new rows, minus the lines the user left out. */
  @Post('import')
  async commitImport(
    @Request() req: AuthedRequest,
    @Body() body: { csv?: unknown; skipLines?: unknown; accountId?: unknown },
  ) {
    const skip = Array.isArray(body?.skipLines) ? new Set(body.skipLines) : new Set()
    let accountId: string | undefined
    if (body?.accountId !== undefined && body.accountId !== null) {
      if (typeof body.accountId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.accountId)) {
        throw new BadRequestException('invalid accountId')
      }
      await this.accounts.assertOwned(req.user.id, body.accountId)
      accountId = body.accountId
    }
    const { rows, duplicates } = await this.readCsv(req.user.id, body?.csv)
    const fresh = rows.filter((r: CsvRow) => !duplicates.has(r.line) && !skip.has(r.line))
    await this.transactions.insertImported(req.user.id, fresh, accountId)
    return { imported: fresh.length, duplicates: duplicates.size }
  }

  /**
   * HOME-03: edit amount, date and note. US-24: fix the category and remember it for similar
   * descriptions. Any of them can come alone.
   */
  @Patch(':id')
  async update(
    @Request() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { category?: string; amount?: unknown; date?: unknown; note?: unknown },
  ) {
    const edit = validateTransactionEdit(
      { amount: body?.amount, date: body?.date, note: body?.note },
      this.transactions.today(),
    )
    if (!edit.ok) throw new BadRequestException(edit.error)
    const hasEdit = Object.keys(edit.value).length > 0
    if (!hasEdit && body?.category === undefined) throw new BadRequestException('nothing to update')

    let slug: string | null = null
    if (body?.category !== undefined) {
      const raw = typeof body.category === 'string' ? body.category.trim().toLowerCase() : ''
      slug = normalizeCategorySlug(raw)
      if (!raw || !CATEGORY_LABELS_ES[slug] || (slug === 'other' && raw !== 'other' && raw !== 'otros')) {
        throw new BadRequestException('unknown category')
      }
      if (await this.transactions.isGoalContribution(req.user.id, id)) {
        throw new BadRequestException('a goal contribution keeps its category')
      }
    }
    if (hasEdit && !(await this.transactions.updateDetails(req.user.id, id, edit.value))) {
      throw new NotFoundException('transaction not found')
    }
    if (slug === null) return { id, remembered: false }
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
