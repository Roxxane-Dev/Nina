import { Injectable } from '@nestjs/common'
import { ExpensesService } from '../../expenses/expenses.service'
import { IncomeService } from '../../income/income.service'
import { GoalService } from '../../goals/goal.service'
import { ConfirmationTokens, type PendingKind } from '../confirmation-token'
import { reply } from '../chat-reply'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'

/** Shared: answer "¿Confirmas?" and sign the parsed registration. */
function askToConfirm(
  tokens: ConfirmationTokens,
  ctx: ChatContext,
  text: string,
  kind: PendingKind,
  payload: Record<string, unknown>,
): HandlerResult {
  return {
    outcome: 'confirmation_requested',
    reply: reply(text, {
      needsConfirmation: true,
      pendingToken: tokens.sign(ctx.userId, { kind, payload }),
    }),
  }
}

/** registrar_ingreso — "me pagaron 3500", "quiero registrar 4500 soles de ingreso". */
@Injectable()
export class RegisterIncomeHandler implements ChatIntentHandler {
  readonly name = 'register_income'
  constructor(private readonly tokens: ConfirmationTokens, private readonly incomeService: IncomeService) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const conf = await this.incomeService.buildPendingFromMessage(ctx.message, ctx.userId)
    return conf ? askToConfirm(this.tokens, ctx, conf.text, 'income', { income: conf.income }) : null
  }
}

/** registrar_meta — "quiero ahorrar 2000 para un viaje". */
@Injectable()
export class RegisterGoalHandler implements ChatIntentHandler {
  readonly name = 'register_goal'
  constructor(private readonly tokens: ConfirmationTokens, private readonly goalService: GoalService) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const conf = await this.goalService.buildPendingFromMessage(ctx.message, ctx.userId)
    return conf ? askToConfirm(this.tokens, ctx, conf.text, 'goal', { goal: conf.goal }) : null
  }
}

/** registrar_gasto — "gasté 25 en taxi y 12 en café". */
@Injectable()
export class RegisterExpenseHandler implements ChatIntentHandler {
  readonly name = 'register_expense'
  constructor(private readonly tokens: ConfirmationTokens, private readonly expensesService: ExpensesService) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const conf = await this.expensesService.buildPendingFromMessage(ctx.message, ctx.userId)
    return conf ? askToConfirm(this.tokens, ctx, conf.text, 'expense', { items: conf.items }) : null
  }
}
