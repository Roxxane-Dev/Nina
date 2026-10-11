import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATEGORY_LABELS_ES,
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
