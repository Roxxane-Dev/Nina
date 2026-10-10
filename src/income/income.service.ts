import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import { parseIncome, type ParsedIncome } from '../expenses/income-parser'
import { isoDate, localToday } from '../../packages/finance-engine/src'

export type PendingIncomePayload = {
  text: string
  income: ParsedIncome
}

@Injectable()
export class IncomeService implements OnModuleInit {
  private readonly logger = new Logger(IncomeService.name)
  private db!: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')

    if (url && key) {
      this.db = createAdminClient(url, key)
      this.logger.log('[INCOME SERVICE] Supabase admin client ready')
    } else {
      this.logger.warn('[INCOME SERVICE] Supabase not configured')
    }
  }

  /**
   * Detects an income in the message.
   * Returns null if no income is found.
   */
  async buildPendingFromMessage(
    message: string,
    userId: string,
  ): Promise<PendingIncomePayload | null> {
    const parsed = parseIncome(message)
    if (!parsed) return null

    const text = this.buildConfirmationText(parsed)
    return { text, income: parsed }
  }

  private buildConfirmationText(income: ParsedIncome): string {
    const categoryLabel: Record<string, string> = {
      salary: 'sueldo/salario',
      freelance: 'freelance/proyecto',
      transfer: 'transferencia',
      other: 'ingreso',
    }
    const label = categoryLabel[income.category] ?? 'ingreso'
    return `Voy a registrar un ${label} de S/ ${income.amount.toFixed(2)}.\n\n¿Confirmas?`
  }

  /**
   * Confirms a pending income — saves directly to transactions ledger.
   */
  async insertIncome(income: ParsedIncome, userId: string): Promise<{ result: string }> {
    if (!this.db) return { result: '¡Ingreso registrado! ✅' }

    // Calendar day in Lima (finance-engine/timezone.ts), not UTC: after 7 p.m. UTC is already tomorrow.
    const today = isoDate(localToday(new Date()))

    const { error: txErr } = await this.db.from('transactions').insert({
      user_id: userId,
      type: 'income',
      amount: income.amount,
      description: income.description,
      category: income.category,
      date: today,
      source_table: 'manual',
      space_id: 'personal',
    })

    if (txErr) {
      this.logger.warn(`[INCOME SERVICE] transactions insert failed: ${txErr.message}`)
      throw txErr
    }

    this.logger.log('[TRANSACTION CREATED] income')

    return { result: `¡Ingreso de S/ ${income.amount.toFixed(2)} registrado! 💚` }
  }

  async findByUser(
    userId: string,
    month?: string,
  ): Promise<any[]> {
    if (!this.db) return []
    let q = this.db.from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'income')
      
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      q = q.gte('date', `${month}-01`).lte('date', `${month}-${lastDay}`)
    }
    const { data, error } = await (q as any).order('date', { ascending: false })
    if (error) {
      this.logger.error(`[INCOME SERVICE] findByUser: ${error.message}`)
      return []
    }
    return data ?? []
  }
}

