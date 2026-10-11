import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../common/supabase.client'
import { FeatureNotReadyError, isMissingSchema } from '../common/feature-not-ready'
import { FinanceDataUnavailableError } from '../finance-engine/errors'

export const ACCOUNT_KINDS = ['bank', 'cash', 'card', 'wallet'] as const
export type AccountKind = (typeof ACCOUNT_KINDS)[number]
export type Account = { id: string; name: string; kind: AccountKind; institution: string | null; archived: boolean }
export type AccountInput = { name: string; kind: AccountKind; institution: string | null }

export class AccountsNotReadyError extends FeatureNotReadyError {
  constructor() {
    super('ACCOUNTS_NOT_READY', 'Las cuentas todavía no están activadas. Inténtalo más tarde.')
    this.name = 'AccountsNotReadyError'
  }
}

/** Validates create/update input; `partial` allows omitting fields (PATCH). */
export function validateAccountInput(
  body: Record<string, unknown>,
  partial = false,
): Partial<AccountInput> & { archived?: boolean } {
  const out: Partial<AccountInput> & { archived?: boolean } = {}
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (name.length < 1 || name.length > 40) throw new BadRequestException('El nombre debe tener entre 1 y 40 caracteres.')
    out.name = name
  }
  if (body.kind !== undefined || !partial) {
    if (!(ACCOUNT_KINDS as readonly unknown[]).includes(body.kind)) {
      throw new BadRequestException("kind must be 'bank', 'cash', 'card' or 'wallet'")
    }
    out.kind = body.kind as AccountKind
  }
  if (body.institution !== undefined) {
    const inst = typeof body.institution === 'string' ? body.institution.trim() : ''
    if (inst.length > 40) throw new BadRequestException('La institución tiene máximo 40 caracteres.')
    out.institution = inst || null
  } else if (!partial) {
    out.institution = null
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== 'boolean') throw new BadRequestException('archived must be boolean')
    out.archived = body.archived
  }
  return out
}

/** US-41 accounts (migration 019). Service role: always scoped by user_id. */
@Injectable()
export class AccountsService implements OnModuleInit {
  private readonly logger = new Logger(AccountsService.name)
  private db?: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) this.db = createAdminClient(url, key)
  }

  private client(): SupabaseClient {
    if (!this.db) throw new FinanceDataUnavailableError('no_client')
    return this.db
  }

  private fail(op: string, error: { code?: string }): never {
    if (isMissingSchema(error.code)) throw new AccountsNotReadyError()
    this.logger.error(`${op} failed: ${error.code ?? 'unknown'}`)
    throw new FinanceDataUnavailableError(error.code)
  }

  async list(userId: string): Promise<Account[]> {
    const { data, error } = await this.client()
      .from('accounts')
      .select('id, name, kind, institution, archived')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) this.fail('list', error)
    return (data ?? []) as Account[]
  }

  async create(userId: string, input: AccountInput): Promise<Account> {
    const { data, error } = await this.client()
      .from('accounts')
      .insert({ user_id: userId, ...input })
      .select('id, name, kind, institution, archived')
      .single()
    if (error) this.fail('create', error)
    return data as Account
  }

  async update(userId: string, id: string, patch: Partial<AccountInput> & { archived?: boolean }): Promise<Account> {
    if (!Object.keys(patch).length) throw new BadRequestException('nothing to update')
    const { data, error } = await this.client()
      .from('accounts')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, name, kind, institution, archived')
    if (error) this.fail('update', error)
    const row = (data ?? [])[0]
    if (!row) throw new NotFoundException('No encontré esa cuenta.')
    return row as Account
  }

  /** 404 unless the account exists, belongs to the user and is active. */
  async assertOwned(userId: string, id: string): Promise<void> {
    const { data, error } = await this.client()
      .from('accounts')
      .select('id, archived')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) this.fail('assertOwned', error)
    if (!data || data.archived) throw new NotFoundException('No encontré esa cuenta.')
  }
}
