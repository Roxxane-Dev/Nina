import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATEGORY_LABELS_ES,
  type CsvRow,
  isoDate,
  localToday,
  normalizeCategorySlug,
  toLocalDay,
} from '../../packages/finance-engine/src'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from '../finance-engine/errors'

export type NewTransactionInput = {
  type: 'income' | 'expense'
  amount: number
  category: string
  /** 'YYYY-MM-DD'; defaults to today in Lima. */
  date?: string
  note?: string
}

export type ValidationResult = { ok: true; value: Required<Omit<NewTransactionInput, 'note'>> & { note: string } } | { ok: false; error: string }

const MAX_AMOUNT = 10_000_000
const MAX_NOTE = 140

/** Pure validation of the form (US-26), shared by tests. */
export function validateNewTransaction(input: Partial<NewTransactionInput>, today: Date): ValidationResult {
  if (input.type !== 'income' && input.type !== 'expense') return { ok: false, error: "type must be 'income' or 'expense'" }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return { ok: false, error: 'amount must be a positive number' }
  }
  if (Math.round(amount * 100) / 100 !== amount) return { ok: false, error: 'amount allows at most 2 decimals' }
  const slug = normalizeCategorySlug(input.category ?? '')
  if (!CATEGORY_LABELS_ES[slug]) return { ok: false, error: 'unknown category' }

  const todayIso = isoDate(today)
  const date = input.date ?? todayIso
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !toLocalDay(date)) return { ok: false, error: 'date must be YYYY-MM-DD' }
  if (date > todayIso) return { ok: false, error: 'date cannot be in the future' }

  const note = (input.note ?? '').trim().slice(0, MAX_NOTE)
  return { ok: true, value: { type: input.type, amount, category: slug, date, note } }
}

export type TransactionEdit = { amount?: number; date?: string; description?: string | null }

/** HOME-03: validates the fields of an edit, with the same rules as a new movement. */
export function validateTransactionEdit(
  input: { amount?: unknown; date?: unknown; note?: unknown },
  today: Date,
): { ok: true; value: TransactionEdit } | { ok: false; error: string } {
  const value: TransactionEdit = {}
  if (input.amount !== undefined) {
    const amount = typeof input.amount === 'number' ? input.amount : Number.NaN
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return { ok: false, error: 'amount must be a positive number' }
    if (Math.round(amount * 100) / 100 !== amount) return { ok: false, error: 'amount allows at most 2 decimals' }
    value.amount = amount
  }
  if (input.date !== undefined) {
    if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !toLocalDay(input.date)) {
      return { ok: false, error: 'date must be YYYY-MM-DD' }
    }
    if (input.date > isoDate(today)) return { ok: false, error: 'date cannot be in the future' }
    value.date = input.date
  }
  if (input.note !== undefined) {
    if (typeof input.note !== 'string') return { ok: false, error: 'note must be text' }
    value.description = input.note.trim().slice(0, MAX_NOTE) || null
  }
  return { ok: true, value }
}

/**
 * Manual create / delete of the user's own transactions (Movimientos).
 * Service-role client: every query is scoped with user_id from the JWT.
 */
@Injectable()
export class TransactionsService implements OnModuleInit {
  private readonly logger = new Logger(TransactionsService.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  /** sharedSpaceId: the caller must have checked membership (SpacesService.assertMember). */
  async create(
    userId: string,
    input: Required<Omit<NewTransactionInput, 'note'>> & { note: string },
    sharedSpaceId?: string,
    accountId?: string,
  ) {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db
      .from('transactions')
      .insert({
        user_id: userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.note || null,
        date: input.date,
        source_table: 'manual',
        space_id: 'personal',
        // Only sent for shared rows, so personal inserts work before migration 017.
        ...(sharedSpaceId ? { shared_space_id: sharedSpaceId } : {}),
        // Only sent when set, so inserts work before migration 019.
        ...(accountId ? { account_id: accountId } : {}),
      })
      .select('id')
      .single()
    if (error) {
      this.logger.error(`create failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return { id: data.id as string }
  }

  /**
   * US-24: change the category of one of the user's movements. Returns the
   * row's description and type (to remember a rule), or null when the row does
   * not exist or is not the user's.
   */
  async updateCategory(
    userId: string,
    id: string,
    category: string,
  ): Promise<{ description: string | null; type: string } | null> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db
      .from('transactions')
      .update({ category })
      .eq('id', id)
      .eq('user_id', userId)
      .select('description, type')
    if (error) {
      this.logger.error(`updateCategory failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    const row = (data ?? [])[0] as { description: string | null; type: string } | undefined
    return row ?? null
  }

  /** DATA-01: what is already registered in the days of the file, to spot duplicates. */
  async existingBetween(userId: string, from: string, to: string) {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const out: Array<{ date: string; amount: number; type: string; description: string | null }> = []
    const pageSize = 1000
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await this.db
        .from('transactions')
        .select('id, date, amount, type, description')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', `${to}T23:59:59.999Z`)
        .order('id')
        .range(start, start + pageSize - 1)
      if (error) {
        this.logger.error(`existingBetween failed: ${error.code ?? 'unknown'}`)
        throw new FinanceDataUnavailableError(error.code)
      }
      for (const r of (data ?? []) as Array<{ date: string; amount: number | string; type: string; description: string | null }>) {
        const day = toLocalDay(r.date)
        if (day) out.push({ date: isoDate(day), amount: Number(r.amount), type: r.type, description: r.description })
      }
      if ((data ?? []).length < pageSize) return out
    }
  }

  /** DATA-01: one insert, so a failed import leaves nothing behind. */
  async insertImported(userId: string, rows: CsvRow[], accountId?: string, source: 'csv' | 'pdf' = 'csv'): Promise<void> {
    if (!rows.length) return
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { error } = await this.db.from('transactions').insert(
      rows.map((r) => ({
        user_id: userId,
        type: r.type,
        amount: r.amount,
        category: r.category,
        description: r.description || null,
        date: r.date,
        source_table: source,
        space_id: 'personal',
        ...(accountId ? { account_id: accountId } : {}),
      })),
    )
    if (error) {
      this.logger.error(`insertImported failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
  }

  /** HOME-03: false when the row does not exist or is not the user's. */
  async updateDetails(userId: string, id: string, edit: TransactionEdit): Promise<boolean> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db
      .from('transactions')
      .update(edit)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
    if (error) {
      this.logger.error(`updateDetails failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return (data ?? []).length > 0
  }

  /** A goal contribution keeps its category (D-015). */
  async isGoalContribution(userId: string, id: string): Promise<boolean> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db
      .from('transactions')
      .select('goal_id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      this.logger.error(`isGoalContribution failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return (data as { goal_id?: string | null } | null)?.goal_id != null
  }

  /** Returns false when the row does not exist or is not the user's (never reveals which). */
  async remove(userId: string, id: string): Promise<boolean> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
    if (error) {
      this.logger.error(`remove failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return (data ?? []).length > 0
  }

  today(): Date {
    return localToday(new Date())
  }
}
