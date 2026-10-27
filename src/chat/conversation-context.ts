import { createHmac, timingSafeEqual } from 'crypto'

/** What Nina is waiting for after her last reply. */
export type Awaiting = 'goal_amount' | 'goal_details' | 'purchase_price' | 'expense_amount'

/**
 * Short conversation context so a follow-up ("7000 dólares", "más simple")
 * is read together with the previous turn. Only the user's own words and an
 * intent name: never figures, never data from other users.
 */
export type ConversationContext = {
  /** The last question answered from engine facts, to re-explain it more simply. */
  lastQuestion?: string
  lastIntent?: string
  awaiting?: Awaiting
  /** User text Nina is completing (e.g. "quiero viajar a japón en enero 2028"). */
  draft?: string
  /** What the user wants to buy, for the price follow-up. */
  item?: string
  /** A goal the user mentioned in this conversation ("un viaje"), not necessarily saved yet. */
  goalTopic?: string
}

/** A conversation goes quiet after this; an old context is simply ignored. */
export const CONTEXT_TTL_MS = 30 * 60 * 1000
const MAX_TEXT = 300

type Envelope = { c: ConversationContext; sub: string; exp: number }

const clip = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, MAX_TEXT) : undefined)

/**
 * Stateless, signed conversation context (same idea as ConfirmationTokens):
 * the app keeps it and sends it back with the next message. Nothing is held in
 * process memory; the token is bound to the user and expires. It is never sent
 * to an LLM.
 */
export class ContextTokens {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error('ContextTokens needs a secret')
  }

  sign(userId: string, ctx: ConversationContext, now = Date.now()): string {
    const c: ConversationContext = {
      lastQuestion: clip(ctx.lastQuestion),
      lastIntent: clip(ctx.lastIntent),
      awaiting: ctx.awaiting,
      draft: clip(ctx.draft),
      item: clip(ctx.item),
      goalTopic: clip(ctx.goalTopic),
    }
    const body = Buffer.from(JSON.stringify({ c, sub: userId, exp: now + CONTEXT_TTL_MS } satisfies Envelope)).toString('base64url')
    return `${body}.${this.mac(body)}`
  }

  verify(token: string | undefined | null, userId: string, now = Date.now()): ConversationContext | null {
    if (!token || typeof token !== 'string' || token.length > 4000) return null
    const [body, mac] = token.split('.')
    if (!body || !mac) return null
    const expected = Buffer.from(this.mac(body))
    const given = Buffer.from(mac)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    try {
      const env = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Envelope
      if (env.sub !== userId || typeof env.exp !== 'number' || env.exp <= now || typeof env.c !== 'object') return null
      return env.c
    } catch {
      return null
    }
  }

  private mac(body: string): string {
    // Different purpose than confirmations: a context token can never pass as a pending registration.
    return createHmac('sha256', this.secret).update(`ctx.${body}`).digest('base64url')
  }
}

/** True when the message carries an amount ("7000 dólares", "cuesta 350", "S/ 80"). */
export function hasAmount(message: string): boolean {
  return /\d/.test(message.replace(/\b20\d\d\b/g, ''))
}
