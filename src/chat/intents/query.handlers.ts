import { Injectable } from '@nestjs/common'
import type { FactsIntent } from '../../../packages/finance-engine/src'
import { FinanceEngineService } from '../../finance-engine/finance-engine.service'
import { NO_DATA_REPLY, suggestedFollowUps } from '../answer-card'
import { reply } from '../chat-reply'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'
import { QueryResponder, periodPhrase } from './query-responder'

const NO_HISTORY: HandlerResult = {
  outcome: 'no_data',
  reply: reply(NO_DATA_REPLY, { followUps: suggestedFollowUps('help') }),
}

/** consulta_saldo — "¿cuál es mi saldo?": historical balance from the engine. */
@Injectable()
export class BalanceQueryHandler implements ChatIntentHandler {
  readonly name = 'balance_query'
  constructor(private readonly engine: FinanceEngineService, private readonly responder: QueryResponder) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    if (ctx.question.intent !== 'balance') return null
    const { facts } = await this.engine.factsForResolved(ctx.userId, ctx.question, ctx.asOf)
    if (!facts.context?.hasHistory) return NO_HISTORY
    return this.responder.explain(ctx, facts)
  }
}

/** Questions answered from period facts. */
const PERIOD_INTENTS = new Set<FactsIntent>([
  'spending_summary',
  'spending_breakdown',
  'category_spend',
  'income',
  'available',
  'recent',
  'forecast',
  'score',
  'subscriptions',
  'goal',
])

/** Intents whose answer does not depend on the selected period. */
const NOT_PERIOD_SCOPED = new Set<FactsIntent>(['recent', 'subscriptions', 'score', 'forecast'])

/** consulta_gasto_por_periodo — spending/income by period, category, breakdown, recent. */
@Injectable()
export class SpendingQueryHandler implements ChatIntentHandler {
  readonly name = 'spending_query'
  constructor(private readonly engine: FinanceEngineService, private readonly responder: QueryResponder) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    if (!PERIOD_INTENTS.has(ctx.question.intent)) return null
    const { facts, recent } = await this.engine.factsForResolved(ctx.userId, ctx.question, ctx.asOf)
    if (!facts.context?.hasHistory) return NO_HISTORY

    // Not an error: the user simply has nothing registered in that period.
    if (!NOT_PERIOD_SCOPED.has(ctx.question.intent) && facts.txnCount === 0) {
      return {
        outcome: 'no_data',
        engineVersion: facts.engineVersion,
        reply: reply(`No tengo movimientos registrados ${periodPhrase(facts)} todavía.`, {
          followUps: ['¿Cuánto gasté este mes?', 'Muéstrame mis últimos gastos', '¿Cuál es mi saldo?'],
        }),
      }
    }
    return this.responder.explain(ctx, facts, recent)
  }
}
