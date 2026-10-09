import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createAdminClient } from '../common/supabase.client'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FinancialLedger {
  /** YYYY-MM */
  month: string
  userId: string
  totalIncome: number
  totalExpenses: number
  /** income - expenses */
  netWorth: number
  /** (income - expenses) / income  0..1 */
  savingsRate: number
  /** months balance can cover current avg burn */
  runwayMonths: number
  /** projected balance at end of month based on current run-rate */
  projectedBalance: number
  byCategory: Record<string, number>
  incomeByCategory: Record<string, number>
  daysRemaining: number
  /** safe-to-spend today = (budget remaining) / days remaining */
  safeToSpendToday: number
}

@Injectable()
export class FinancialLedgerService implements OnModuleInit {
  private readonly logger = new Logger(FinancialLedgerService.name)
  private db!: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')
    if (url && key) {
      this.db = createAdminClient(url, key)
      this.logger.log('[LEDGER] Supabase admin client ready')
    }
  }

  /**
   * Calculates deterministic financial ledger from real DB data.
   * NO mocks. NO snapshots dependency.
   */
  async getLedger(userId: string, month?: string): Promise<FinancialLedger> {
    const now = new Date()
    const targetMonth =
      month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [y, m] = targetMonth.split('-').map(Number)
    const firstDay = `${targetMonth}-01`
    const lastDayNum = new Date(y, m, 0).getDate()
    const lastDay = `${targetMonth}-${String(lastDayNum).padStart(2, '0')}`

    this.logger.log(`[HOME PAYLOAD] Computing ledger for userId=${userId} month=${targetMonth}`)

    // Fetch expenses and incomes in parallel
    const [expenses, incomes] = await Promise.all([
      this.fetchExpenses(userId, firstDay, lastDay),
      this.fetchIncomes(userId, firstDay, lastDay),
    ])

    // Aggregate
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)

    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      const cat = e.category as string ?? 'other'
      byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount)
    }

    const incomeByCategory: Record<string, number> = {}
    for (const i of incomes) {
      const cat = i.category as string ?? 'other'
      incomeByCategory[cat] = (incomeByCategory[cat] ?? 0) + Number(i.amount)
    }

    const netWorth = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? Math.max(0, netWorth / totalIncome) : 0

    // Days remaining in month
    const daysInMonth = lastDayNum
    const currentDay = now.getMonth() + 1 === m && now.getFullYear() === y
      ? now.getDate()
      : daysInMonth
    const daysRemaining = Math.max(1, daysInMonth - currentDay + 1)

    // Projected end-of-month based on run-rate
    const dailyBurn = currentDay > 0 ? totalExpenses / currentDay : 0
    const projectedExpenses = dailyBurn * daysInMonth
    const projectedBalance = totalIncome - projectedExpenses

    // Runway based on past 3-month avg (simplified: use current month income as proxy)
    const avgMonthlyBurn = dailyBurn * 30 || 1
    const runwayMonths = totalIncome > 0 ? totalIncome / avgMonthlyBurn : 0

    // Safe to spend today
    const remainingBudget = Math.max(0, totalIncome - totalExpenses)
    const safeToSpendToday = daysRemaining > 0 ? remainingBudget / daysRemaining : 0

    return {
      month: targetMonth,
      userId,
      totalIncome,
      totalExpenses,
      netWorth,
      savingsRate,
      runwayMonths,
      projectedBalance,
      byCategory,
      incomeByCategory,
      daysRemaining,
      safeToSpendToday,
    }
  }

  private async fetchExpenses(userId: string, from: string, to: string) {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('transactions')
      .select('amount, category, description, date')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to)
    if (error) {
      this.logger.warn(`[LEDGER] transactions(expense) fetch failed: ${error.message}`)
      return []
    }
    return data ?? []
  }

  private async fetchIncomes(userId: string, from: string, to: string) {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('transactions')
      .select('amount, category, description, date')
      .eq('user_id', userId)
      .eq('type', 'income')
      .gte('date', from)
      .lte('date', to)
    if (error) {
      this.logger.warn(`[LEDGER] transactions(income) fetch failed: ${error.message}`)
      return []
    }
    return data ?? []
  }

  async getAllUsersWithData(): Promise<string[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('user_profiles')
      .select('id')
      .limit(500)
    if (error) {
      this.logger.error(`[LEDGER] getAllUsers failed: ${error.message}`)
      return []
    }
    return (data ?? []).map((r: any) => r.id as string)
  }
}
