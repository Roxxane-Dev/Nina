import type { AnswerCard } from './answer-card'

/** Body of POST /chat. */
export type ChatReply = {
  reply: string
  /** True when Nina asks the user to confirm a registration (show Sí / No). */
  needsConfirmation: boolean
  /** Signed pending registration; the app sends it back with the user's "sí". */
  pendingToken?: string
  followUps: string[]
  /** Result card with the exact engine figures (FR-11). */
  card?: AnswerCard
  /** Present for answers built from engine facts. */
  grounded?: { intent: string; validationPassed: boolean; usedLlm: boolean; engineVersion: string }
}

export const reply = (text: string, extra: Partial<ChatReply> = {}): ChatReply => ({
  reply: text,
  needsConfirmation: false,
  followUps: [],
  ...extra,
})
