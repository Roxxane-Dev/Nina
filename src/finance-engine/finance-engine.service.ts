import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFactsPayload,
  computeForecast,
  recentTransactions,
  resolveQuestion,
  type ResolvedQuestion,
  buildBalanceFacts,
  computeHealthScore,
  detectAnomalies,
  detectRecurrence,
  localToday,
  type EngineTransaction,
  type FactsIntent,
  type FactsPayload,
} from '../../packages/finance-engine/src'
import { createAdminClient } from '../common/supabase.client'
import { NinaFinanceEngine } from '../intelligence/nina-finance.engine'
import { FinanceDataUnavailableError } from './errors'
import { toEngineTransactions, type TransactionRow } from './map-transactions'

@Injectable()
export class FinanceEngineService implements OnModuleInit {
  private readonly logger = new Logger(FinanceEngineService.name)
  private db!: SupabaseClient

  constructor(
    private readonly config: ConfigService,
    private readonly snapshotEngine: NinaFinanceEngine,
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
    const { data, error } = await this.db
      .from('transactions')
      .select('id, type, amount, category, description, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(2000)
    if (error) {
      // A failed read is an infrastructure problem, never "the user has no data".
      this.logger.error(`loadTransactions failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    const { txs, dropped } = toEngineTransactions((data ?? []) as TransactionRow[])
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

  /** Convenience: resolve + compute in one call. */
  async factsForQuestion(userId: string, question: string, asOf = localToday(new Date())) {
    const q = resolveQuestion(question, asOf)
    return { intent: q.intent, ...(await this.factsForResolved(userId, q, asOf)) }
  }

  getSnapshot(userId: string) {
    return this.snapshotEngine.getSnapshot(userId)
  }
}
