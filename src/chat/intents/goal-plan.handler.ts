import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { parseGoalRequest } from '../../../packages/finance-engine/src'
import { usdPenRate } from '../../common/usd-rate'
import { FinanceEngineService } from '../../finance-engine/finance-engine.service'
import { goalFromRequest, goalSaveOffer } from '../../goals/goal.service'
import { reply } from '../chat-reply'
import { ConfirmationTokens } from '../confirmation-token'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'
import { QueryResponder } from './query-responder'

const ASK_AMOUNT =
  'Para armarte un plan necesito dos datos: de cuánto es la meta y para cuándo. Por ejemplo: "quiero juntar 6000 soles para enero 2028".'
const DEADLINE_PAST =
  'Esa fecha ya pasó o es este mismo mes, así que no hay plan que armar. Dime una fecha futura (por ejemplo "diciembre 2027" o "en 12 meses") y lo calculamos.'

/**
 * plan_meta — "¿cómo alcanzo mis 6000 soles para enero 2028?". The engine computes what to save
 * per month against the user's real savings pace; the LLM only explains it. Afterwards Nina offers
 * to save the goal (signed confirmation), so a question is never registered by itself.
 */
@Injectable()
export class GoalPlanHandler implements ChatIntentHandler {
  readonly name = 'goal_plan'
  constructor(
    private readonly engine: FinanceEngineService,
    private readonly responder: QueryResponder,
    private readonly tokens: ConfirmationTokens,
    private readonly config: ConfigService,
  ) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    if (ctx.question.intent !== 'goal_plan') return null
    const req = parseGoalRequest(ctx.message, ctx.asOf)
    if (!req) return { outcome: 'unrecognized', reply: reply(ASK_AMOUNT) }
    if (req.deadlinePast) return { outcome: 'unrecognized', reply: reply(DEADLINE_PAST) }

    const rate = usdPenRate(this.config)
    const facts = await this.engine.goalPlanFacts(ctx.userId, req, ctx.asOf, rate)
    const result = await this.responder.explain(ctx, facts)
    if (ctx.calm) return result

    // Offer to save it: the signed payload carries the goal exactly as the engine read it.
    const goal = goalFromRequest(req, rate)
    const ask = goalSaveOffer(goal)
    return {
      ...result,
      reply: {
        ...result.reply,
        reply: `${result.reply.reply}\n\n${ask}`,
        needsConfirmation: true,
        pendingToken: this.tokens.sign(ctx.userId, { kind: 'goal', payload: { goal } }),
      },
    }
  }
}
