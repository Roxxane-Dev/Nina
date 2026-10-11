import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import {
  buildOverview,
  localToday,
  memberContributions,
  parsePeriodParam,
  type EngineTransaction,
} from '../../packages/finance-engine/src'
import { createAdminClient } from '../common/supabase.client'
import { FinanceDataUnavailableError } from '../finance-engine/errors'
import { toEngineTransactions, type TransactionRow } from '../finance-engine/map-transactions'
import { SpacesNotReadyError, isMissingSchema } from './spaces.errors'

export type SpaceType = 'pareja' | 'familia' | 'otro'
export type SpaceSummary = { id: string; name: string; type: SpaceType; role: 'owner' | 'member'; memberCount: number }

/** No I/O/0/1 so codes can be read aloud and typed without confusion. */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const INVITE_TTL_DAYS = 7

export function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 8; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]
  return code
}

export function normalizeInviteCode(raw: string | undefined): string | null {
  const code = (raw ?? '').toUpperCase().replace(/[\s-]/g, '')
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null
}

/**
 * Shared spaces (US-33 to US-38). The service role bypasses RLS, so every
 * method checks membership itself before reading or writing a space.
 */
@Injectable()
export class SpacesService implements OnModuleInit {
  private readonly logger = new Logger(SpacesService.name)
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

  /** Maps a Supabase error: missing schema → not ready (migration 017), anything else → data unavailable. */
  private fail(op: string, error: { code?: string; message?: string }): never {
    if (isMissingSchema(error.code)) throw new SpacesNotReadyError()
    this.logger.error(`${op} failed: ${error.code ?? 'unknown'}`)
    throw new FinanceDataUnavailableError(error.code)
  }

  /** Role of the user in the space; 404 when not a member (never reveals that the space exists). */
  async assertMember(userId: string, spaceId: string): Promise<'owner' | 'member'> {
    const { data, error } = await this.client()
      .from('space_members')
      .select('role')
      .eq('space_id', spaceId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) this.fail('assertMember', error)
    if (!data) throw new NotFoundException('space not found')
    return data.role as 'owner' | 'member'
  }

  async listMine(userId: string): Promise<SpaceSummary[]> {
    const db = this.client()
    const { data: mine, error } = await db.from('space_members').select('space_id, role').eq('user_id', userId)
    if (error) this.fail('listMine', error)
    if (!mine?.length) return []
    const ids = mine.map((m) => m.space_id as string)
    const [{ data: spaces, error: e1 }, { data: members, error: e2 }] = await Promise.all([
      db.from('spaces').select('id, name, type').in('id', ids),
      db.from('space_members').select('space_id').in('space_id', ids),
    ])
    if (e1) this.fail('listMine.spaces', e1)
    if (e2) this.fail('listMine.members', e2)
    return (spaces ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      type: s.type as SpaceType,
      role: mine.find((m) => m.space_id === s.id)?.role as 'owner' | 'member',
      memberCount: (members ?? []).filter((m) => m.space_id === s.id).length,
    }))
  }

  /** Spaces for chat detection; [] when spaces are not enabled yet or unreadable. */
  async listMineOrEmpty(userId: string): Promise<SpaceSummary[]> {
    try {
      return await this.listMine(userId)
    } catch {
      return []
    }
  }

  /** US-33. The creator becomes the owner. */
  async create(userId: string, name: string, type: SpaceType): Promise<SpaceSummary> {
    const db = this.client()
    const { data, error } = await db.from('spaces').insert({ name, type, owner_id: userId }).select('id').single()
    if (error) this.fail('create', error)
    const id = data.id as string
    const { error: memberError } = await db.from('space_members').insert({ space_id: id, user_id: userId, role: 'owner' })
    if (memberError) {
      await db.from('spaces').delete().eq('id', id)
      this.fail('create.member', memberError)
    }
    return { id, name, type, role: 'owner', memberCount: 1 }
  }

  /** US-34. Any member can invite; the code lasts 7 days. */
  async createInvite(userId: string, spaceId: string): Promise<{ code: string; expiresAt: string }> {
    await this.assertMember(userId, spaceId)
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateInviteCode()
      const { error } = await this.client()
        .from('space_invites')
        .insert({ code, space_id: spaceId, created_by: userId, expires_at: expiresAt })
      if (!error) return { code, expiresAt }
      if (error.code !== '23505') this.fail('createInvite', error) // 23505 = code collision: retry
    }
    throw new FinanceDataUnavailableError('invite_collision')
  }

  /** US-34. Joining twice is harmless. */
  async join(userId: string, rawCode: string): Promise<SpaceSummary> {
    const code = normalizeInviteCode(rawCode)
    if (!code) throw new BadRequestException('El código tiene 8 letras y números.')
    const db = this.client()
    const { data: invite, error } = await db.from('space_invites').select('space_id, expires_at').eq('code', code).maybeSingle()
    if (error) this.fail('join', error)
    if (!invite) throw new NotFoundException('Ese código no existe. Revisa que esté bien escrito.')
    if (new Date(invite.expires_at as string).getTime() < Date.now()) {
      throw new GoneException('Ese código ya venció. Pide uno nuevo.')
    }
    const { error: upsertError } = await db
      .from('space_members')
      .upsert({ space_id: invite.space_id, user_id: userId, role: 'member' }, { onConflict: 'space_id,user_id', ignoreDuplicates: true })
    if (upsertError) this.fail('join.member', upsertError)
    const spaces = await this.listMine(userId)
    const joined = spaces.find((s) => s.id === invite.space_id)
    if (!joined) throw new FinanceDataUnavailableError('join_not_visible')
    return joined
  }

  /**
   * US-38. The others keep the space. If the owner leaves, the oldest member
   * becomes owner; if nobody is left, the space is deleted (its rows go back
   * to being personal for their authors).
   */
  async leave(userId: string, spaceId: string): Promise<{ deleted: boolean }> {
    const role = await this.assertMember(userId, spaceId)
    const db = this.client()
    const { error } = await db.from('space_members').delete().eq('space_id', spaceId).eq('user_id', userId)
    if (error) this.fail('leave', error)

    const { data: rest, error: restError } = await db
      .from('space_members')
      .select('user_id, joined_at')
      .eq('space_id', spaceId)
      .order('joined_at', { ascending: true })
    if (restError) this.fail('leave.rest', restError)
    if (!rest?.length) {
      const { error: delError } = await db.from('spaces').delete().eq('id', spaceId)
      if (delError) this.fail('leave.delete', delError)
      return { deleted: true }
    }
    if (role === 'owner') {
      const heir = rest[0].user_id as string
      await db.from('space_members').update({ role: 'owner' }).eq('space_id', spaceId).eq('user_id', heir)
      await db.from('spaces').update({ owner_id: heir }).eq('id', spaceId)
    }
    return { deleted: false }
  }

  /** Every row of the space, from any member (engine shape, with authorId). */
  async loadSpaceTransactions(spaceId: string): Promise<{ txs: EngineTransaction[]; rows: TransactionRow[] }> {
    const { data, error } = await this.client()
      .from('transactions')
      .select('id, user_id, type, amount, category, description, date, shared_space_id')
      .eq('shared_space_id', spaceId)
      .order('date', { ascending: false })
      .limit(2000)
    if (error) this.fail('loadSpaceTransactions', error)
    const rows = (data ?? []) as Array<TransactionRow & { user_id: string }>
    const { txs } = toEngineTransactions(rows)
    const author = new Map(rows.map((r) => [String(r.id), r.user_id]))
    return { txs: txs.map((t) => ({ ...t, authorId: author.get(t.id), sharedSpaceId: spaceId })), rows }
  }

  /** Member ids with a display name (full name, else the part before @). */
  async members(spaceId: string): Promise<Array<{ userId: string; name: string; role: string }>> {
    const db = this.client()
    const { data, error } = await db.from('space_members').select('user_id, role').eq('space_id', spaceId)
    if (error) this.fail('members', error)
    const ids = (data ?? []).map((m) => m.user_id as string)
    const { data: profiles } = ids.length
      ? await db.from('profiles').select('id, full_name, email').in('id', ids)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }
    return (data ?? []).map((m) => {
      const p = (profiles ?? []).find((x) => x.id === m.user_id)
      const name = p?.full_name?.trim() || p?.email?.split('@')[0] || 'Miembro'
      return { userId: m.user_id as string, name, role: m.role as string }
    })
  }

  /** US-36 + US-37: the space's own totals and who registered what. */
  async overview(userId: string, spaceId: string, period?: string) {
    await this.assertMember(userId, spaceId)
    const asOf = localToday(new Date())
    const range = parsePeriodParam(period, asOf)
    if (!range) throw new BadRequestException("period must be 'current', 'previous' or 'YYYY-MM'")
    const [{ txs }, members] = await Promise.all([this.loadSpaceTransactions(spaceId), this.members(spaceId)])
    const contributions = memberContributions(txs, range, members.map((m) => m.userId))
    return {
      ...buildOverview(txs, range, asOf),
      members: contributions.map((c) => ({
        ...c,
        name: members.find((m) => m.userId === c.userId)?.name ?? 'Ex miembro',
        isMe: c.userId === userId,
      })),
    }
  }

  /** US-37: the space's movements with who registered each one. */
  async transactions(userId: string, spaceId: string) {
    await this.assertMember(userId, spaceId)
    const [{ rows }, members] = await Promise.all([this.loadSpaceTransactions(spaceId), this.members(spaceId)])
    return rows.slice(0, 200).map((r) => {
      const author = (r as TransactionRow & { user_id: string }).user_id
      return {
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        category: r.category,
        description: r.description,
        date: r.date,
        author: members.find((m) => m.userId === author)?.name ?? 'Ex miembro',
        isMine: author === userId,
      }
    })
  }
}
