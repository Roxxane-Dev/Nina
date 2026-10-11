import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  matchCategoryRule,
  normalizeCategorySlug,
  normalizeRulePattern,
  type CategoryRule,
} from '../../packages/finance-engine/src'
import { createAdminClient } from '../common/supabase.client'

/**
 * The user's remembered category corrections (US-24), table category_rules
 * (migration 016). Service-role client: always scoped by user_id.
 */
@Injectable()
export class CategoryRulesService implements OnModuleInit {
  private readonly logger = new Logger(CategoryRulesService.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  async listForUser(userId: string): Promise<CategoryRule[]> {
    if (!this.db) return []
    const { data, error } = await this.db.from('category_rules').select('pattern, category').eq('user_id', userId).limit(500)
    if (error) {
      // Rules only refine categorization: if they cannot be read, the default rules still apply.
      this.logger.warn(`listForUser failed: ${error.code ?? 'unknown'}`)
      return []
    }
    return (data ?? []) as CategoryRule[]
  }

  /** Category slug remembered for this text, or null. */
  async categoryFor(userId: string, text: string): Promise<string | null> {
    if (!normalizeRulePattern(text)) return null
    return matchCategoryRule(text, await this.listForUser(userId))
  }

  /** Remember "this description → this category". No-op for very short descriptions. */
  async remember(userId: string, description: string, category: string): Promise<boolean> {
    const pattern = normalizeRulePattern(description)
    if (!this.db || !pattern) return false
    const { error } = await this.db.from('category_rules').upsert(
      { user_id: userId, pattern, category: normalizeCategorySlug(category), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,pattern' },
    )
    if (error) {
      this.logger.warn(`remember failed: ${error.code ?? 'unknown'}`)
      return false
    }
    return true
  }
}
