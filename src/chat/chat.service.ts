import { Injectable, Logger } from '@nestjs/common'
import { localToday, resolveQuestion } from '../../packages/finance-engine/src'
import { MemoryService } from '../memory/memory.service'
import { ChatTelemetry, hashUserId } from './chat-telemetry'
import type { ChatReply } from './chat-reply'
import { ConfirmationHandler } from './intents/confirmation.handler'
import { GeneralHandler } from './intents/general.handler'
import type { ChatContext, ChatIntentHandler } from './intents/handler'
import { BalanceQueryHandler, SpendingQueryHandler } from './intents/query.handlers'
import {
  RegisterExpenseHandler,
  RegisterGoalHandler,
  RegisterIncomeHandler,
} from './intents/registration.handlers'

export type { ChatReply } from './chat-reply'

/**
 * ChatService — orchestrates one chat turn.
 *
 * 1. Resolve the question deterministically (intent, period, category).
 * 2. Try the intent handlers in order; the first that answers wins:
 *    confirmation → register income → register goal → register expense
 *    → balance query → spending query → general (always answers).
 * 3. Log one structured `chat_turn` line. Errors are logged with their stack
 *    and rethrown; ChatExceptionFilter turns them into 503/500 with requestId.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly handlers: ChatIntentHandler[]

  constructor(
    confirmation: ConfirmationHandler,
    registerIncome: RegisterIncomeHandler,
    registerGoal: RegisterGoalHandler,
    registerExpense: RegisterExpenseHandler,
    balanceQuery: BalanceQueryHandler,
    spendingQuery: SpendingQueryHandler,
    private readonly general: GeneralHandler,
    private readonly memoryService: MemoryService,
    private readonly telemetry: ChatTelemetry,
  ) {
    this.handlers = [confirmation, registerIncome, registerGoal, registerExpense, balanceQuery, spendingQuery, general]
  }

  async handleMessage(
    userId: string,
    message: string,
    pendingToken?: string,
    requestId = 'local',
  ): Promise<ChatReply> {
    const started = Date.now()
    const asOf = localToday(new Date())
    const ctx: ChatContext = { userId, message, pendingToken, asOf, question: resolveQuestion(message, asOf) }
    const turn = {
      requestId,
      userHash: hashUserId(userId),
      intent: ctx.question.intent,
      period: ctx.question.period.explicit ? ctx.question.period.granularity : 'default',
    }

    let handlerName = 'none'
    try {
      for (const handler of this.handlers) {
        handlerName = handler.name
        const result = await handler.handle(ctx)
        if (!result) continue
        this.telemetry.record({
          ...turn,
          handler: handler.name,
          outcome: result.outcome,
          llmUsed: result.llmUsed,
          validationPassed: result.validationPassed,
          engineVersion: result.engineVersion,
          latencyMs: Date.now() - started,
        })
        this.memoryService
          .storeExchange(userId, message, result.reply.reply)
          .catch((e) => this.logger.warn(`storeExchange failed: ${e instanceof Error ? e.name : 'error'}`))
        return result.reply
      }
      // GeneralHandler always answers; reaching here is a wiring bug.
      throw new Error('No chat handler answered')
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      this.telemetry.record({
        ...turn,
        handler: handlerName,
        outcome: 'error',
        errorType: e.name,
        latencyMs: Date.now() - started,
        stack: e.stack,
      })
      throw err
    }
  }
}
