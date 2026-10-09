import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'

export type PendingKind = 'expense' | 'income' | 'goal'
export type PendingAction = { kind: PendingKind; payload: Record<string, unknown> }

/** Confirmations expire so a stale "sí" never saves an old expense. */
export const PENDING_TTL_MS = 15 * 60 * 1000

/**
 * Persists the one pending chat confirmation per user in
 * `chat_pending_actions` (migration 014) instead of process memory.
 */
@Injectable()
export class PendingActionsStore implements OnModuleInit {
  private readonly logger = new Logger(PendingActionsStore.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  async get(userId: string, now = new Date()): Promise<PendingAction | null> {
    if (!this.db) return null
    const { data, error } = await this.db
      .from('chat_pending_actions')
      .select('kind, payload, expires_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      this.logger.warn(`get failed: ${error.code ?? error.message}`)
      return null
    }
    if (!data) return null
    if (new Date(data.expires_at).getTime() <= now.getTime()) {
      await this.clear(userId)
      return null
    }
    return { kind: data.kind as PendingKind, payload: data.payload as Record<string, unknown> }
  }

  async set(userId: string, action: PendingAction, now = new Date()): Promise<void> {
    if (!this.db) return
    const { error } = await this.db.from('chat_pending_actions').upsert({
      user_id: userId,
      kind: action.kind,
      payload: action.payload,
      expires_at: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
    })
    if (error) this.logger.warn(`set failed: ${error.code ?? error.message}`)
  }

  async clear(userId: string): Promise<void> {
    if (!this.db) return
    const { error } = await this.db.from('chat_pending_actions').delete().eq('user_id', userId)
    if (error) this.logger.warn(`clear failed: ${error.code ?? error.message}`)
  }
}
