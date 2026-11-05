import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFactsPayload,
  computeForecast,
  recentTransactions,
  resolveQuestion,
  buildOverview,
  monthlyTrend,
  parsePeriodParam,
  type Overview,
  type TrendPoint,
  type ResolvedQuestion,
  buildBalanceFacts,
  buildGoalPlanFacts,
  type GoalRequest,
  computeHealthScore,
  detectAnomalies,
  detectRecurrence,
  localToday,
  type EngineTransaction,
  type FactsIntent,
  type FactsPayload,
  buildMonthOutlook,
  upcomingPayments,
} from '../../packages/finance-engine/src'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from './errors'
import { toEngineTransactions, type TransactionRow } from './map-transactions'

export const TRANSACTIONS_PAGE_SIZE = 1000

@Injectable()
export class FinanceEngineService implements OnModuleInit {
  private readonly logger = new Logger(FinanceEngineService.name)
  private db!: SupabaseClient

  constructor(
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')
    if (url && key) {
      this.db = createAdminClient(url, key)
    }
  }

  async loadTransactions(userId: string): Promise<EngineTransaction[]> {
    if (!this.db) return []
    // PostgREST caps a response at 1000 rows without saying so, and a partial history means wrong
    // figures. Every row is read, page by page; id keeps the pages stable.
    const rows: TransactionRow[] = []
    for (let from = 0; ; from += TRANSACTIONS_PAGE_SIZE) {
      const { data, error } = await this.db
        .from('transactions')
        .select('id, type, amount, category, description, date, goal_id')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('id')
        .range(from, from + TRANSACTIONS_PAGE_SIZE - 1)
      if (error) {
        // A failed read is an infrastructure problem, never "the user has no data".
        this.logger.error(`loadTransactions failed: ${error.code ?? 'unknown'}`)
        throw new FinanceDataUnavailableError(error.code)
      }
      rows.push(...((data ?? []) as TransactionRow[]))
      if ((data ?? []).length < TRANSACTIONS_PAGE_SIZE) break
    }
    const { txs, dropped } = toEngineTransactions(rows)
    if (dropped > 0) this.logger.warn(`loadTransactions: dropped ${dropped} row(s) with invalid date or amount`)
    return txs
  }

  /** asOf defaults to today's calendar day in Lima (finance-engine/timezone.ts). */
  async computeBundle(userId: string, asOf = localToday(new Date())) {
    const txs = await this.loadTransactions(userId)
    const recurring = detectRecurrence(txs, asOf)
    const score = computeHealthScore(txs, asOf, { recurring })
    const forecast = computeForecast(txs, asOf, { recurring })
    const anomalies = detectAnomalies(txs, asOf)
    return { txs, recurring, score, forecast, anomalies, asOf }
  }

  async factsForIntent(userId: string, intent: FactsIntent, asOf = localToday(new Date())): Promise<FactsPayload> {
    const bundle = await this.computeBundle(userId, asOf)
    return buildFactsPayload({
      intent,
      txs: bundle.txs,
      asOf,
      score: bundle.score,
      forecast: bundle.forecast,
      recurring: bundle.recurring,
    })
  }

  /**
   * Engine facts for an already-resolved question (packages/finance-engine
   * question.ts): the intent, period and category are decided before any I/O.
   */
  async factsForResolved(userId: string, q: ResolvedQuestion, asOf = localToday(new Date())) {
    const bundle = await this.computeBundle(userId, asOf)
    if (q.intent === 'balance') {
      return { facts: buildBalanceFacts({ txs: bundle.txs, asOf }), recent: undefined }
    }
    const facts = buildFactsPayload({
      intent: q.intent,
      txs: bundle.txs,
      asOf,
      period: q.period,
      category: q.category,
      score: bundle.score,
      forecast: bundle.forecast,
      recurring: bundle.recurring,
    })
    const recent = q.intent === 'recent' ? recentTransactions(bundle.txs, 8) : undefined
    return { facts, recent }
  }

  /** Plan for a goal (what to save per month vs. the user's real pace). Numbers come only from the engine. */
  async goalPlanFacts(userId: string, goal: GoalRequest, asOf = localToday(new Date()), usdPenRate?: number): Promise<FactsPayload> {
    return buildGoalPlanFacts({ txs: await this.loadTransactions(userId), asOf, goal, usdPenRate })
  }

  /** Convenience: resolve + compute in one call. */
  async factsForQuestion(userId: string, question: string, asOf = localToday(new Date())) {
    const q = resolveQuestion(question, asOf)
    return { intent: q.intent, ...(await this.factsForResolved(userId, q, asOf)) }
  }

  /** Overview for a period param ('current' | 'previous' | 'YYYY-MM'); null when the param is invalid. */
  /** INS-01 / INS-03: where the month is heading, and the fixed payments coming up. */
  async outlook(userId: string, asOf = localToday(new Date())) {
    const txs = await this.loadTransactions(userId)
    return { outlook: buildMonthOutlook(txs, asOf), upcoming: upcomingPayments(txs, asOf) }
  }

  async overview(userId: string, period?: string, asOf = localToday(new Date())): Promise<Overview | null> {
    const range = parsePeriodParam(period, asOf)
    if (!range) return null
    return buildOverview(await this.loadTransactions(userId), range, asOf)
  }

  async trends(userId: string, months: number, asOf = localToday(new Date())): Promise<TrendPoint[]> {
    return monthlyTrend(await this.loadTransactions(userId), asOf, months)
  }
}
