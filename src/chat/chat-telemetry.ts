import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import type { ChatOutcome } from './intents/handler'

/**
 * One structured line per chat turn. Never contains the message text, amounts,
 * descriptions or the raw user id — only what is needed to debug a failure.
 */
export type ChatTurnEvent = {
  event: 'chat_turn'
  requestId: string
  userHash: string
  handler: string
  intent: string
  period?: string
  outcome: ChatOutcome | 'error'
  errorType?: string
  llmUsed?: boolean
  validationPassed?: boolean
  latencyMs: number
  engineVersion?: string
  stack?: string
}

export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12)
}

@Injectable()
export class ChatTelemetry {
  private readonly logger = new Logger('ChatTurn')

  record(event: Omit<ChatTurnEvent, 'event'>): void {
    const line = JSON.stringify({ event: 'chat_turn', ...event })
    if (event.outcome === 'error') this.logger.error(line)
    else this.logger.log(line)
  }
}
