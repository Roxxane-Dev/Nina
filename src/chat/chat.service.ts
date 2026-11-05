import { Injectable, Logger, Optional } from '@nestjs/common'
import { localToday, resolveQuestion } from '../../packages/finance-engine/src'
import { MemoryService } from '../memory/memory.service'
import { ConsentsService } from '../consents/consents.service'
import { CALM_REPLIES, WORRY_PREFIX, detectCalmTopic, isDataQuestion } from './calm-mode'
import { ChatTelemetry, hashUserId } from './chat-telemetry'
import type { ChatReply } from './chat-reply'
import { ContextTokens, hasAmount, type ConversationContext } from './conversation-context'
import { ConfirmationHandler } from './intents/confirmation.handler'
import { ConversationHandler } from './intents/conversation.handler'
import { GeneralHandler } from './intents/general.handler'
import { GoalPlanHandler } from './intents/goal-plan.handler'
import { GoalProgressHandler } from './intents/goal-progress.handler'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './intents/handler'
import { BalanceQueryHandler, SpendingQueryHandler } from './intents/query.handlers'
import {
  RegisterExpenseHandler,
  RegisterGoalHandler,
  RegisterIncomeHandler,
} from './intents/registration.handlers'

export type { ChatReply } from './chat-reply'

/** Intents answered from engine facts: "más simple" re-explains the last one of these. */
const DATA_INTENTS = new Set(['spending_summary', 'spending_breakdown', 'category_spend', 'income', 'available', 'balance', 'goal_plan'])

/**
 * The follow-up completes what Nina asked for: "7000 dólares" after "¿de cuánto
 * es el viaje?" is read together with the original sentence. Deterministic.
 */
export function completeWithContext(message: string, conv: ConversationContext | null | undefined): string {
  if (!conv?.awaiting || !conv.draft || !hasAmount(message)) return message
  switch (conv.awaiting) {
    case 'goal_amount':
    case 'goal_details':
      return `${conv.draft} ${message}`
    case 'expense_amount':
      return /\b(gast|pagu|compr)/i.test(message) ? message : `gasté ${message.replace(/^\s*(fue|fueron|como|unos?)\s+/i, '')} en ${conv.draft}`
    default:
      return message
  }
}

/**
 * ChatService — orchestrates one chat turn.
 *
 * 1. Read the signed conversation context (if any) and complete the message with it.
 * 2. Resolve the question deterministically (intent, period, category).
 * 3. Try the intent handlers in order; the first that answers wins:
 *    confirmation → conversation → goal plan → register income → register goal
 *    → register expense → balance query → spending query → general (always answers).
 * 4. Sign the new context into the reply and log one structured `chat_turn` line.
 *    Errors are logged with their stack and rethrown; ApiExceptionFilter turns
 *    them into 503/500 with requestId.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly handlers: ChatIntentHandler[]

  constructor(
    confirmation: ConfirmationHandler,
    goalPlan: GoalPlanHandler,
    registerIncome: RegisterIncomeHandler,
    registerGoal: RegisterGoalHandler,
    registerExpense: RegisterExpenseHandler,
    balanceQuery: BalanceQueryHandler,
    spendingQuery: SpendingQueryHandler,
    private readonly general: GeneralHandler,
    private readonly memoryService: MemoryService,
    private readonly telemetry: ChatTelemetry,
    private readonly consents: ConsentsService,
    @Optional() conversation?: ConversationHandler,
    @Optional() private readonly contextTokens?: ContextTokens,
    @Optional() goalProgress?: GoalProgressHandler,
  ) {
    this.handlers = [
      confirmation,
      ...(goalProgress ? [goalProgress] : []),
      ...(conversation ? [conversation] : []),
      goalPlan,
      registerIncome,
      registerGoal,
      registerExpense,
      balanceQuery,
      spendingQuery,
      general,
    ]
  }

  async handleMessage(
    userId: string,
    original: string,
    pendingToken?: string,
    requestId = 'local',
    contextToken?: string,
  ): Promise<ChatReply> {
    const started = Date.now()
    const asOf = localToday(new Date())
    const conversation = this.contextTokens?.verify(contextToken, userId) ?? null
    const message = completeWithContext(original, conversation)
    const aiAllowed = await this.consents.allowsAi(userId)
    const calm = detectCalmTopic(message)
    let question = resolveQuestion(message, asOf)
    // Worried about making it to payday: answer with the real numbers, calmly.
    if (calm === 'worry') question = resolveQuestion('¿cuánto me queda este mes?', asOf)
    const ctx: ChatContext = { userId, message, pendingToken, asOf, question, aiAllowed, calm, conversation }
    const turn = {
      requestId,
      userHash: hashUserId(userId),
      intent: ctx.question.intent,
      period: ctx.question.period.explicit ? ctx.question.period.granularity : 'default',
    }

    let handlerName = 'none'
    try {
      // Distress always gets the fixed reply with the crisis resource, even if the
      // message also looks like a data question or a registration. No LLM, no figures.
      // Debt and income-loss statements that are not questions about the numbers also get the fixed reply.
      if (calm === 'distress' || (calm && calm !== 'worry' && !isDataQuestion(message))) {
        const fixed = CALM_REPLIES[calm]
        this.telemetry.record({ ...turn, handler: 'calm', outcome: 'ok', llmUsed: false, latencyMs: Date.now() - started })
        return { reply: fixed.reply, needsConfirmation: false, followUps: fixed.followUps }
      }
      for (const handler of this.handlers) {
        handlerName = handler.name
        const result = await handler.handle(ctx)
        if (!result) continue
        if (calm === 'worry' && result.reply.grounded) {
          result.reply.reply = `${WORRY_PREFIX} ${result.reply.reply.replace(/^Vamos con calma\.\s*/, '')}`
        }
        this.telemetry.record({
          ...turn,
          handler: handler.name,
          outcome: result.outcome,
          llmUsed: result.llmUsed,
          validationPassed: result.validationPassed,
          engineVersion: result.engineVersion,
          latencyMs: Date.now() - started,
        })
        // Memory embeddings send the text to an LLM provider: only with AI consent.
        if (aiAllowed) this.memoryService
          .storeExchange(userId, message, result.reply.reply)
          .catch((e) => this.logger.warn(`storeExchange failed: ${e instanceof Error ? e.name : 'error'}`))
        return this.withContext(userId, message, result, conversation)
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

  /** Signs what the next turn needs: what Nina asked for, and the last data question. */
  private withContext(userId: string, message: string, result: HandlerResult, previous: ConversationContext | null): ChatReply {
    if (!this.contextTokens) return result.reply
    const intent = result.reply.grounded?.intent
    const next: ConversationContext = {
      lastQuestion: intent && DATA_INTENTS.has(intent) ? message : previous?.lastQuestion,
      lastIntent: intent ?? previous?.lastIntent,
      // A goal mentioned earlier stays in the conversation until it is saved or the context expires.
      goalTopic: result.awaiting?.kind === 'goal_details' && result.awaiting.item ? result.awaiting.item : previous?.goalTopic,
    }
    if (result.awaiting) {
      next.awaiting = result.awaiting.kind
      next.draft = result.awaiting.draft
      next.item = result.awaiting.item
    }
    return { ...result.reply, context: this.contextTokens.sign(userId, next) }
  }
}
