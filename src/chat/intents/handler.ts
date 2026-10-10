import type { ResolvedQuestion } from '../../../packages/finance-engine/src'
import type { ChatReply } from '../chat-reply'

/** What happened in a turn — for telemetry and tests, never shown to the user. */
export type ChatOutcome =
  | 'ok'
  | 'template_fallback'
  | 'no_data'
  | 'unrecognized'
  | 'confirmation_requested'
  | 'saved'
  | 'cancelled'
  | 'no_pending'

export type ChatContext = {
  userId: string
  message: string
  pendingToken?: string
  /** Lima calendar day the turn is answered for. */
  asOf: Date
  /** Deterministic reading of the message (intent, period, category). */
  question: ResolvedQuestion
}

export type HandlerResult = {
  reply: ChatReply
  outcome: ChatOutcome
  llmUsed?: boolean
  validationPassed?: boolean
  engineVersion?: string
}

/**
 * One handler per intent family. Handlers are tried in order; `handle` returns
 * null when the message is not theirs (registration handlers can only tell by
 * running their parser).
 */
export interface ChatIntentHandler {
  readonly name: string
  handle(ctx: ChatContext): Promise<HandlerResult | null>
}
