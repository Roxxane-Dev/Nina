import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import { parseExpenses, type ParsedExpense } from './expense-parser'
import { normalizeCategorySlug } from '../../packages/finance-engine/src'
import type { UserInsights } from '../ai/ai.types'

export type ResolvedExpense = {
  amount: number
  category_id: string
  category_name: string
  /** Canonical engine slug ('food', 'transport', …) stored in transactions.category. */
  category_slug?: string
  description: string
}

export type ConfirmationPayload = {
  text: string
  items: ResolvedExpense[]
}

export type UpdateExpenseInput = {
  amount?: number
  category?: string
  description?: string
  date?: string
  source?: string
}

export type Expense = {
  id: string
  user_id: string
  amount: number
  category: string
  description: string | null
  date: string
  source: string
  created_at: string
}

const CONFIRM_WORDS = /^\s*(?:s[ií]|confirmar?|dale|va|claro|ok|okay|venga|listo)\s*[!.]*\s*$/i
const CANCEL_WORDS = /^\s*(?:no|cancelar?|olvida(?:lo)?|nope)\s*[!.]*\s*$/i

export function detectConfirmIntent(msg: string): 'confirm' | 'cancel' | null {
  if (CONFIRM_WORDS.test(msg)) return 'confirm'
  if (CANCEL_WORDS.test(msg)) return 'cancel'
  return null
}

@Injectable()
export class ExpensesService implements OnModuleInit {
  private readonly logger = new Logger(ExpensesService.name)
  private db!: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')

    if (url && key) {
      this.db = createAdminClient(url, key)
      this.logger.log('ExpensesService: admin Supabase client ready')
    } else {
      this.logger.warn('Supabase not configured; ExpensesService is a no-op')
    }
  }

  async buildPendingFromMessage(
    message: string,
    userId: string,
  ): Promise<ConfirmationPayload | null> {
    const parsed = parseExpenses(message)
    if (parsed.length === 0) return null

    const resolved: ResolvedExpense[] = []
    for (const item of parsed) {
      const category = await this.resolveCategory(item.normalizedCategory)
      resolved.push({
        amount: item.amount,
        category_id: category.id,
        category_name: category.name,
        category_slug: normalizeCategorySlug(item.normalizedCategory),
        description: item.rawCategory,
      })
    }
    
    return this.buildConfirmationMessage(resolved)
  }

  async insertExpenses(items: ResolvedExpense[], userId: string): Promise<{ result: string }> {
    if (!this.db) return { result: 'Listo, gastos registrados ✅' }

    const today = new Date().toISOString().split('T')[0]
    const { error: insertError } = await this.db.from('transactions').insert(
      items.map((e) => ({
        user_id: userId,
        amount: e.amount,
        type: 'expense',
        category: e.category_slug ?? normalizeCategorySlug(e.category_name),
        description: e.description,
        date: today,
        source_table: 'manual',
        space_id: 'personal',
      })),
    )

    if (insertError) {
      this.logger.error(`insertExpenses failed: ${insertError.message}`)
      throw insertError
    }

    this.logger.log(`Inserted ${items.length} expense(s)`)
    return { result: 'Listo, gastos registrados ✅' }
  }

  private async resolveCategory(normalized: string): Promise<{ id: string; name: string }> {
    if (!this.db) return { id: 'offline', name: normalized }

    const { data, error } = await this.db
      .from('categories')
      .select('id, name, normalized_name')
      .in('normalized_name', [normalized, 'other'])
      .eq('is_system', true)
      .order('normalized_name', { ascending: true })
      .limit(2)

    if (error) {
      this.logger.warn(`resolveCategory failed: ${error.message}`)
      return { id: 'offline', name: normalized }
    }

    const rows = (data ?? []) as any[]
    const exact = rows.find((r) => r.normalized_name === normalized)
    const fallback = rows.find((r) => r.normalized_name === 'other')
    const chosen = exact ?? fallback

    if (!chosen) {
      throw new Error(`Category "${normalized}" not found and no fallback`)
    }

    return { id: chosen.id, name: chosen.name }
  }

  private buildConfirmationMessage(items: ResolvedExpense[]): ConfirmationPayload {
    const lines = items.map((e) => `• $${e.amount} en ${e.category_name}`)
    const text = `Voy a registrar:\n${lines.join('\n')}\n\n¿Confirmas?`
    return { text, items }
  }

  async findByUser(userId: string): Promise<Expense[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .order('date', { ascending: false })

    if (error) {
      this.logger.error(`transactions expense select failed: ${error.message}`)
      throw error
    }
    return (data ?? []) as Expense[]
  }

  async createExpense(
    userId: string,
    body: { amount: number; category: string; description?: string; date?: string; source?: string },
  ): Promise<Expense> {
    if (!this.db) throw new Error('Supabase not configured')
    const { data, error } = await this.db
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'expense',
        amount: body.amount,
        category: body.category,
        description: body.description ?? null,
        date: body.date ?? new Date().toISOString(),
        source_table: body.source ?? 'manual',
        space_id: 'personal',
      })
      .select()
      .single()
    if (error) throw error
    return data as Expense
  }

  async updateExpense(
    userId: string,
    id: string,
    body: UpdateExpenseInput,
  ): Promise<Expense> {
    if (!this.db) throw new NotFoundException('Supabase not configured')
    const { data, error } = await this.db
      .from('transactions')
      .update({
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.source !== undefined && { source_table: body.source }),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('type', 'expense')
      .select()
      .single()
    if (error) throw error
    if (!data) throw new NotFoundException(`Expense ${id} not found`)
    return data as Expense
  }

  async updateUserProfile(userId: string): Promise<UserInsights | null> {
    if (!this.db) return null
    try {
      const { data, error } = await this.db
        .from('transactions')
        .select(`amount, date, category`)
        .eq('user_id', userId)
        .eq('type', 'expense')

      if (error) {
        this.logger.warn(`updateUserProfile query failed: ${error.message}`)
        return null
      }

      const rows = (data ?? []) as any[]
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth()
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear

      let currentMonthTotal = 0
      let previousMonthTotal = 0
      const totals: Record<string, number> = {}

      for (const r of rows) {
        if (!r.date) continue
        const d = new Date(r.date)
        const y = d.getFullYear()
        const m = d.getMonth()

        if (y === currentYear && m === currentMonth) {
          currentMonthTotal += Number(r.amount)
          const catName = r.category ?? 'Otros'
          totals[catName] = (totals[catName] ?? 0) + Number(r.amount)
        } else if (y === previousYear && m === previousMonth) {
          previousMonthTotal += Number(r.amount)
        }
      }

      const trend = currentMonthTotal > previousMonthTotal ? 'up' : currentMonthTotal < previousMonthTotal ? 'down' : 'stable'
      const currentDay = today.getDate()
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      const dailyAvg = currentMonthTotal / currentDay
      const forecast = currentMonthTotal === 0 ? 0 : dailyAvg * daysInMonth
      const budgetLimit = previousMonthTotal || currentMonthTotal * 1.2
      const warning = forecast > budgetLimit * 0.9
      const overBudget = forecast > budgetLimit
      const unusual = currentMonthTotal > previousMonthTotal * 1.3
      const topCategory = Object.entries(totals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

      const insights: UserInsights = {
        monthly_spending: currentMonthTotal,
        previous_month_spending: previousMonthTotal,
        trend,
        by_category: totals,
        top_category: topCategory,
        unusual_spending: unusual,
        forecast_end_of_month: forecast,
        over_budget: overBudget,
        warning: warning,
      }

      const { error: upsertError } = await this.db
        .from('user_profiles')
        .upsert(
          { id: userId, updated_at: new Date().toISOString(), insights },
          { onConflict: 'id' },
        )

      if (upsertError) this.logger.warn(`updateUserProfile upsert failed: ${upsertError.message}`)
      return insights
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.warn(`updateUserProfile threw: ${msg}`)
      return null
    }
  }
}

