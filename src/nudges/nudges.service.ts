import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from '../finance-engine/errors'

/** Which nudges the user closed. The nudges themselves are computed by the engine, never stored. */
@Injectable()
export class NudgesService implements OnModuleInit {
  private readonly logger = new Logger(NudgesService.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  async dismissedKeys(userId: string): Promise<Set<string>> {
    if (!this.db) return new Set()
    const { data, error } = await this.db.from('nudge_dismissals').select('nudge_key').eq('user_id', userId)
    if (error) {
      this.logger.error(`dismissedKeys failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    return new Set((data ?? []).map((r) => (r as { nudge_key: string }).nudge_key))
  }

  async dismiss(userId: string, key: string): Promise<void> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { error } = await this.db
      .from('nudge_dismissals')
      .upsert({ user_id: userId, nudge_key: key }, { onConflict: 'user_id,nudge_key' })
    if (error) {
      this.logger.error(`dismiss failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
  }
}
