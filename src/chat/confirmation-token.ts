import { createHmac, timingSafeEqual } from 'crypto'

export type PendingKind = 'expense' | 'income' | 'goal'
export type PendingAction = { kind: PendingKind; payload: Record<string, unknown> }

/** Confirmations expire so a stale "sí" never saves an old expense. */
export const PENDING_TTL_MS = 15 * 60 * 1000

type Envelope = PendingAction & { sub: string; exp: number }

/**
 * Stateless pending confirmations.
 *
 * The server signs the parsed registration (HMAC-SHA256) and returns it to the
 * app, which sends it back with the user's "sí". Nothing is kept in process
 * memory or in a table, and the token is bound to the JWT user and expires.
 */
export class ConfirmationTokens {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error('ConfirmationTokens needs a secret')
  }

  sign(userId: string, action: PendingAction, now = Date.now()): string {
    const envelope: Envelope = { ...action, sub: userId, exp: now + PENDING_TTL_MS }
    const body = Buffer.from(JSON.stringify(envelope)).toString('base64url')
    return `${body}.${this.mac(body)}`
  }

  /** Returns the action only if the signature is valid, unexpired and for this user. */
  verify(token: string | undefined | null, userId: string, now = Date.now()): PendingAction | null {
    if (!token || typeof token !== 'string') return null
    const [body, mac] = token.split('.')
    if (!body || !mac) return null
    const expected = Buffer.from(this.mac(body))
    const given = Buffer.from(mac)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    try {
      const env = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Envelope
      if (env.sub !== userId || typeof env.exp !== 'number' || env.exp <= now) return null
      if (!['expense', 'income', 'goal'].includes(env.kind)) return null
      return { kind: env.kind, payload: env.payload }
    } catch {
      return null
    }
  }

  private mac(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url')
  }
}

/**
 * Secret from CHAT_CONFIRM_SECRET, or derived from the service-role key so no
 * new configuration is required in dev. Never logged.
 */
export function confirmationSecret(env: {
  CHAT_CONFIRM_SECRET?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}): string {
  const explicit = env.CHAT_CONFIRM_SECRET?.trim()
  if (explicit) return explicit
  const base = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!base) throw new Error('Set CHAT_CONFIRM_SECRET or SUPABASE_SERVICE_ROLE_KEY')
  return createHmac('sha256', base).update('nina-chat-confirmation-v1').digest('hex')
}
