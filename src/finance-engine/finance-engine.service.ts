import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFactsPayload,
  classifyIntent,
  computeForecast,
  detectCategoryInText,
  recentTransactions,
  resolvePeriod,
  computeHealthScore,
  detectAnomalies,
  detectRecurrence,
  type EngineTransaction,
  type FactsIntent,
  type FactsPayload,
} from '../../packages/finance-engine/src'
import { createAdminClient } from '../common/supabase.client'
import { NinaFinanceEngine } from '../intelligence/nina-finance.engine'
import { toEngineTransaction } from './map-transactions'

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
      this.logger.warn(`loadTransactions: ${error.message}`)
      return []
    }
    return (data ?? []).map((row) => toEngineTransaction(row as never))
  }

  async computeBundle(userId: string, asOf = new Date()) {
    const txs = await this.loadTransactions(userId)
    const recurring = detectRecurrence(txs, asOf)
    const score = computeHealthScore(txs, asOf, { recurring })
    const forecast = computeForecast(txs, asOf, { recurring })
    const anomalies = detectAnomalies(txs, asOf)
    return { txs, recurring, score, forecast, anomalies, asOf }
  }

  async factsForIntent(userId: string, intent: FactsIntent, asOf = new Date()): Promise<FactsPayload> {
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
   * Turns a chat question into engine facts: intent, period ('el mes pasado',
   * 'en julio') and category are detected deterministically here.
   */
  async factsForQuestion(userId: string, question: string, asOf = new Date()) {
    const period = resolvePeriod(question, asOf)
    const classified = classifyIntent(question)
    // "¿y el mes pasado?" / "¿y en julio?": a bare period means a spending summary.
    const intent = classified === 'other' && period.explicit ? 'spending_summary' : classified
    const bundle = await this.computeBundle(userId, asOf)
    const facts = buildFactsPayload({
      intent,
      txs: bundle.txs,
      asOf,
      period,
      category: intent === 'category_spend' ? detectCategoryInText(question) : null,
      score: bundle.score,
      forecast: bundle.forecast,
      recurring: bundle.recurring,
    })
    const recent = intent === 'recent' ? recentTransactions(bundle.txs, 8) : undefined
    return { intent, facts, recent }
  }

  getSnapshot(userId: string) {
    return this.snapshotEngine.getSnapshot(userId)
  }
}
