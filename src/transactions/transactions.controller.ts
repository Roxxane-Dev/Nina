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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
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
  parseStatement,
  type CsvRow,
} from '../../packages/finance-engine/src'
import { extractPdfLines, MAX_PDF_BYTES, type PdfTextError } from '../statements/pdf-text'
import { CategoryRulesService } from '../category-rules/category-rules.service'
import { SpacesService } from '../spaces/spaces.service'
import { AccountsService } from '../accounts/accounts.service'
import { TransactionsService, validateNewTransaction, validateTransactionEdit, type NewTransactionInput } from './transactions.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

type UploadedPdf = { buffer: Buffer }

/** `code` lets the app ask for the password instead of showing an error. */
const PDF_ERRORS: Record<PdfTextError | 'unsupported', string> = {
  too_large: 'El PDF es muy grande.',
  password_required: 'Este PDF tiene contraseña.',
  wrong_password: 'Esa contraseña no abre el PDF.',
  too_many_pages: 'El PDF tiene demasiadas páginas.',
  no_text: 'Este PDF es una imagen escaneada y todavía no puedo leerlo. Descarga el estado de cuenta original desde tu banca.',
  unreadable: 'No pude abrir este PDF.',
  unsupported: 'Todavía no sé leer este estado de cuenta. Por ahora leo tarjetas del BCP.',
}

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

  /** DATA-02: same two steps as a CSV. The PDF and its password stay in memory for this request only. */
  private async readPdf(userId: string, file: UploadedPdf | undefined, password: unknown) {
    if (!file?.buffer?.length || file.buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
      throw new BadRequestException('Falta el PDF.')
    }
    const text = await extractPdfLines(new Uint8Array(file.buffer), typeof password === 'string' && password ? password : undefined)
    if (!text.ok) throw new BadRequestException({ statusCode: 400, code: text.error, message: PDF_ERRORS[text.error] })
    const statement = parseStatement(text.lines, { today: this.transactions.today(), rules: await this.rules.listForUser(userId) })
    if (!statement) throw new BadRequestException({ statusCode: 400, code: 'unsupported', message: PDF_ERRORS.unsupported })
    const days = statement.rows.map((r) => r.date).sort()
    const existing = days.length ? await this.transactions.existingBetween(userId, days[0], days[days.length - 1]) : []
    return { ...statement, duplicates: duplicateLines(statement.rows, existing) }
  }

  @Post('import/pdf/preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }))
  async previewPdf(@Request() req: AuthedRequest, @UploadedFile() file: UploadedPdf | undefined, @Body() body: { password?: unknown }) {
    const s = await this.readPdf(req.user.id, file, body?.password)
    return {
      product: s.product,
      period: s.period,
      reconciliation: s.reconciliation,
      rows: s.rows.map((r: CsvRow) => ({ ...r, categoryLabel: categoryLabel(r.category), duplicate: s.duplicates.has(r.line) })),
      skipped: s.skipped,
      assumedExpenses: false,
    }
  }

  @Post('import/pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }))
  async commitPdf(
    @Request() req: AuthedRequest,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: { password?: unknown; skipLines?: unknown },
  ) {
    const s = await this.readPdf(req.user.id, file, body?.password)
    let skip = new Set<unknown>()
    try {
      const parsed: unknown = JSON.parse(typeof body?.skipLines === 'string' ? body.skipLines : '[]')
      if (Array.isArray(parsed)) skip = new Set(parsed)
    } catch {
      throw new BadRequestException('invalid skipLines')
    }
    const fresh = s.rows.filter((r: CsvRow) => !s.duplicates.has(r.line) && !skip.has(r.line))
    await this.transactions.insertImported(req.user.id, fresh, undefined, 'pdf')
    return { imported: fresh.length, duplicates: s.duplicates.size }
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
