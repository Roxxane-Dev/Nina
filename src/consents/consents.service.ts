import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { FeatureNotReadyError, isMissingSchema } from '../common/feature-not-ready'

/** Migration 018 pending: consents cannot be stored yet (503 CONSENTS_NOT_READY). */
export class ConsentsNotReadyError extends FeatureNotReadyError {
  constructor() {
    super('CONSENTS_NOT_READY', 'Los permisos todavía no se pueden guardar. Inténtalo más tarde.')
    this.name = 'ConsentsNotReadyError'
  }
}

export const CONSENT_PURPOSES = ['data_processing', 'ai_processing', 'analytics'] as const
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]
/** Bump when the privacy text changes: users are asked again. */
export const POLICY_VERSION = '2026-10-v1'

export type ConsentState = {
  policyVersion: string
  /** True once the user answered the current policy version. */
  answered: boolean
  /** False while migration 018 is pending: consents cannot be stored yet. */
  available: boolean
  consents: Record<ConsentPurpose, boolean>
}

const NONE: Record<ConsentPurpose, boolean> = { data_processing: false, ai_processing: false, analytics: false }

/**
 * Consent log (US-03 / US-42), table consents (migration 018). Append-only:
 * the current state of each purpose is its latest row.
 */
@Injectable()
export class ConsentsService implements OnModuleInit {
  private readonly logger = new Logger(ConsentsService.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  async current(userId: string): Promise<ConsentState> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const { data, error } = await this.db
      .from('consents')
      .select('purpose, granted, policy_version, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      // Before migration 018 the app keeps working as before (data), but AI stays
      // off (fail closed) and the app is told consents are not available yet.
      if (isMissingSchema(error.code)) {
        return { policyVersion: POLICY_VERSION, answered: true, available: false, consents: { ...NONE, data_processing: true } }
      }
      this.logger.error(`current failed: ${error.code ?? 'unknown'}`)
      throw new FinanceDataUnavailableError(error.code)
    }
    const consents = { ...NONE }
    const seen = new Set<string>()
    let answered = false
    for (const row of data ?? []) {
      if (seen.has(row.purpose as string)) continue
      seen.add(row.purpose as string)
      consents[row.purpose as ConsentPurpose] = row.granted === true
      if (row.policy_version === POLICY_VERSION) answered = true
    }
    return { policyVersion: POLICY_VERSION, answered, available: true, consents }
  }

  /** Records only the purposes whose value changed (or all, the first time). */
  async record(userId: string, choices: Partial<Record<ConsentPurpose, boolean>>): Promise<ConsentState> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    const before = await this.current(userId)
    if (!before.available) throw new ConsentsNotReadyError()
    const rows = CONSENT_PURPOSES.filter((p) => typeof choices[p] === 'boolean')
      .filter((p) => !before.answered || before.consents[p] !== choices[p])
      .map((p) => ({ user_id: userId, purpose: p, granted: choices[p], policy_version: POLICY_VERSION }))
    if (rows.length) {
      const { error } = await this.db.from('consents').insert(rows)
      if (error) {
        this.logger.error(`record failed: ${error.code ?? 'unknown'}`)
        throw new FinanceDataUnavailableError(error.code)
      }
    }
    return this.current(userId)
  }

  /** May Nina send this user's (redacted, engine-computed) facts to an LLM? */
  async allowsAi(userId: string): Promise<boolean> {
    try {
      const s = await this.current(userId)
      return s.consents.data_processing && s.consents.ai_processing
    } catch {
      return false // fail closed: no consent information → no LLM
    }
  }
}
