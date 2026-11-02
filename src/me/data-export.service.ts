import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from '../finance-engine/errors'

/**
 * SEC-04: everything Nina keeps about one person. Each table names the column that says the row is
 * theirs, so a shared space's rows from other members never come along. Chat embeddings are left out
 * on purpose: they are numbers derived from the messages, not the person's data.
 */
const EXPORT_TABLES: Array<{ table: string; owner: string; select?: string; order?: string }> = [
  { table: 'profiles', owner: 'id' },
  { table: 'user_profiles', owner: 'id' },
  { table: 'transactions', owner: 'user_id' },
  { table: 'goals', owner: 'user_id' },
  { table: 'accounts', owner: 'user_id' },
  { table: 'budgets', owner: 'user_id' },
  { table: 'category_rules', owner: 'user_id' },
  { table: 'subscriptions', owner: 'user_id' },
  { table: 'messages', owner: 'user_id', select: 'id, role, content, created_at' },
  { table: 'ai_insights', owner: 'user_id' },
  { table: 'consents', owner: 'user_id' },
  { table: 'nudge_dismissals', owner: 'user_id', order: 'nudge_key' },
  { table: 'spaces', owner: 'owner_id' },
  { table: 'space_members', owner: 'user_id', order: 'space_id' },
  { table: 'financial_streaks', owner: 'user_id' },
  { table: 'academy_progress', owner: 'user_id' },
]

/** PostgREST caps a response, so long tables are read page by page. */
export const EXPORT_PAGE_SIZE = 1000

export type DataExport = {
  formatVersion: 1
  exportedAt: string
  tables: Record<string, unknown[]>
}

@Injectable()
export class DataExportService implements OnModuleInit {
  private readonly logger = new Logger(DataExportService.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  async collect(userId: string): Promise<DataExport> {
    const tables: DataExport['tables'] = {}
    for (const t of EXPORT_TABLES) tables[t.table] = await this.readAll(t, userId)
    return { formatVersion: 1, exportedAt: new Date().toISOString(), tables }
  }

  private async readAll(t: (typeof EXPORT_TABLES)[number], userId: string): Promise<unknown[]> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const rows: unknown[] = []
    for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
      const { data, error } = await this.db
        .from(t.table)
        .select(t.select ?? '*')
        .eq(t.owner, userId)
        .order(t.order ?? 'id')
        .range(from, from + EXPORT_PAGE_SIZE - 1)
      if (error) {
        // An incomplete export must fail, never pass for the whole thing.
        this.logger.error(`export failed: ${t.table} ${error.code ?? 'unknown'}`)
        throw new FinanceDataUnavailableError(error.code)
      }
      rows.push(...(data ?? []))
      if ((data ?? []).length < EXPORT_PAGE_SIZE) return rows
    }
  }
}
