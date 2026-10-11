import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { SpacesService } from '../../spaces/spaces.service'
import { ExpensesService, detectConfirmIntent, type ResolvedExpense } from '../../expenses/expenses.service'
import { IncomeService } from '../../income/income.service'
import { GoalService, type ParsedGoal } from '../../goals/goal.service'
import type { ParsedIncome } from '../../expenses/income-parser'
import { ConfirmationTokens, type PendingAction } from '../confirmation-token'
import { reply } from '../chat-reply'
import { suggestedFollowUps } from '../answer-card'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'

const AFTER_SAVE_FOLLOW_UPS = ['¿Cuánto me queda?', '¿Cuánto gasté este mes?', '¿En qué gasto más?']

/** "sí" / "no" answering a registration Nina asked to confirm. */
@Injectable()
export class ConfirmationHandler implements ChatIntentHandler {
  readonly name = 'confirmation'
  private readonly logger = new Logger(ConfirmationHandler.name)

  constructor(
    private readonly tokens: ConfirmationTokens,
    private readonly expensesService: ExpensesService,
    private readonly incomeService: IncomeService,
    private readonly goalService: GoalService,
    @Optional() private readonly spaces?: SpacesService,
  ) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const confirmIntent = detectConfirmIntent(ctx.message)
    if (!confirmIntent) return null

    const pending = this.tokens.verify(ctx.pendingToken, ctx.userId)
    if (!pending) {
      return {
        outcome: 'no_pending',
        reply: reply(
          confirmIntent === 'confirm'
            ? 'No encontré un registro pendiente (pudo haber expirado). Cuéntamelo de nuevo, por ejemplo: "gasté 25 en taxi".'
            : 'Listo, no registré nada. ¿En qué más te ayudo?',
          { followUps: suggestedFollowUps('help') },
        ),
      }
    }
    if (confirmIntent === 'cancel') {
      return {
        outcome: 'cancelled',
        reply: reply('Entendido, cancelé el registro. ¿Hay algo más en lo que te pueda ayudar?'),
      }
    }
    // US-35: membership is checked again at save time (it may have changed since the question).
    const spaceId = typeof pending.payload.spaceId === 'string' ? pending.payload.spaceId : undefined
    if (spaceId) {
      try {
        if (!this.spaces) throw new NotFoundException()
        await this.spaces.assertMember(ctx.userId, spaceId)
      } catch (e) {
        if (!(e instanceof NotFoundException)) throw e
        return {
          outcome: 'cancelled',
          reply: reply('Ya no perteneces a ese espacio compartido, así que no registré nada. ¿Lo registro como personal? Cuéntamelo de nuevo.'),
        }
      }
    }
    const saved = await this.commit(ctx.userId, pending, spaceId)
    const name = typeof pending.payload.spaceName === 'string' ? pending.payload.spaceName : null
    return {
      outcome: 'saved',
      reply: reply(name ? `${saved}
Quedó en el espacio «${name}».` : saved, { followUps: AFTER_SAVE_FOLLOW_UPS }),
    }
  }

  private async commit(userId: string, pending: PendingAction, spaceId?: string): Promise<string> {
    const { kind, payload } = pending
    if (kind === 'income') {
      return (await this.incomeService.insertIncome(payload.income as ParsedIncome, userId, spaceId)).result
    }
    if (kind === 'goal') {
      return (await this.goalService.insertGoal(payload.goal as ParsedGoal, userId)).result
    }
    const { result } = await this.expensesService.insertExpenses(payload.items as ResolvedExpense[], userId, spaceId)
    // Keeps user_profiles fresh for the nightly job's user list.
    this.expensesService
      .updateUserProfile(userId)
      .catch((e) => this.logger.warn(`updateUserProfile failed: ${e instanceof Error ? e.name : 'error'}`))
    return result
  }
}
