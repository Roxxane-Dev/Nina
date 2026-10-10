import { Injectable, Logger } from '@nestjs/common'
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
    return {
      outcome: 'saved',
      reply: reply(await this.commit(ctx.userId, pending), { followUps: AFTER_SAVE_FOLLOW_UPS }),
    }
  }

  private async commit(userId: string, pending: PendingAction): Promise<string> {
    const { kind, payload } = pending
    if (kind === 'income') {
      return (await this.incomeService.insertIncome(payload.income as ParsedIncome, userId)).result
    }
    if (kind === 'goal') {
      return (await this.goalService.insertGoal(payload.goal as ParsedGoal, userId)).result
    }
    const { result } = await this.expensesService.insertExpenses(payload.items as ResolvedExpense[], userId)
    // Keeps user_profiles fresh for the nightly job's user list.
    this.expensesService
      .updateUserProfile(userId)
      .catch((e) => this.logger.warn(`updateUserProfile failed: ${e instanceof Error ? e.name : 'error'}`))
    return result
  }
}
