import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import type { UserInsights } from '../ai/ai.types'

@Injectable()
export class InsightsService implements OnModuleInit {
  private readonly logger = new Logger(InsightsService.name)
  private db!: SupabaseClient

  constructor(private readonly config: ConfigService) { }

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')

    if (url && key) {
      this.db = createAdminClient(url, key)
      this.logger.log('InsightsService: Supabase admin client ready')
    } else {
      this.logger.warn('InsightsService: Supabase not configured — insights disabled')
    }
  }

  /**
   * Returns a financial snapshot for the user: total spent, top category
   * name, and a per-category breakdown.
   *
   * Joins expenses → categories so the frontend always gets human-readable
   * names (e.g. "Comida") NOT internal keys (e.g. "food").
   *
   * Returns null when no expenses exist or DB is unavailable.
   */
  async getUserInsights(userId: string): Promise<UserInsights | null> {
    if (!this.db) return null

    try {
      const { data, error } = await this.db
        .from('user_profiles')
        .select('insights')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        this.logger.warn(`getUserInsights query failed: ${error.message}`)
        return null
      }

      return (data?.insights as UserInsights) ?? null
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.warn(`getUserInsights threw: ${msg}`)
      return null
    }
  }

  /**
   * Builds a compact plain-text summary of the user's spending
   * suitable for injection into the LLM system prompt.
   */
  formatForPrompt(insights: UserInsights): string {
    const lines = [
      `- Gasto mensual: $${insights.monthly_spending.toFixed(2)}`,
      `- Mes anterior: $${insights.previous_month_spending.toFixed(2)}`,
      `- Tendencia: ${insights.trend === 'up' ? 'subida' : insights.trend === 'down' ? 'bajada' : 'estable'}`,
      `- Proyección fin de mes: $${insights.forecast_end_of_month?.toFixed(2) ?? 'N/A'}`,
      `- Categoría principal: ${insights.top_category ?? 'N/A'}`,
    ]
    return lines.join('\n')
  }
}
