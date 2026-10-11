import { Injectable, Optional } from '@nestjs/common'
import { detectSpaceReference, type SpaceMatch } from '../../../packages/finance-engine/src'
import { ExpensesService } from '../../expenses/expenses.service'
import { IncomeService } from '../../income/income.service'
import { GoalService } from '../../goals/goal.service'
import { SpacesService } from '../../spaces/spaces.service'
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

/** US-35: "es de la casa" → which of the user's spaces (if any). */
async function resolveSpace(spaces: SpacesService | undefined, ctx: ChatContext): Promise<SpaceMatch> {
  if (!spaces) return null
  const mine = await spaces.listMineOrEmpty(ctx.userId)
  return detectSpaceReference(ctx.message, mine.map((s) => ({ id: s.id, name: s.name })))
}

/** Adds where the movement will go to the confirmation text, and the space to the signed payload. */
function withSpace(text: string, payload: Record<string, unknown>, match: SpaceMatch) {
  if (!match) return { text, payload }
  if ('ambiguous' in match) {
    return {
      text: text.replace(
        '¿Confirmas?',
        'Tienes varios espacios compartidos: si es de uno, dime cuál (por ejemplo "es de Casa"). Si confirmas ahora, lo registro como personal.\n\n¿Confirmas?',
      ),
      payload,
    }
  }
  return {
    text: text.replace('¿Confirmas?', `Irá al espacio compartido «${match.name}».\n\n¿Confirmas?`),
    payload: { ...payload, spaceId: match.spaceId, spaceName: match.name },
  }
}

/** registrar_ingreso — "me pagaron 3500", "quiero registrar 4500 soles de ingreso". */
@Injectable()
export class RegisterIncomeHandler implements ChatIntentHandler {
  readonly name = 'register_income'
  constructor(
    private readonly tokens: ConfirmationTokens,
    private readonly incomeService: IncomeService,
    @Optional() private readonly spaces?: SpacesService,
  ) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const conf = await this.incomeService.buildPendingFromMessage(ctx.message, ctx.userId)
    if (!conf) return null
    const { text, payload } = withSpace(conf.text, { income: conf.income }, await resolveSpace(this.spaces, ctx))
    return askToConfirm(this.tokens, ctx, text, 'income', payload)
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

/** registrar_gasto — "gasté 25 en taxi y 12 en café"; "pagué 1200 de alquiler, es de la casa" (US-35). */
@Injectable()
export class RegisterExpenseHandler implements ChatIntentHandler {
  readonly name = 'register_expense'
  constructor(
    private readonly tokens: ConfirmationTokens,
    private readonly expensesService: ExpensesService,
    @Optional() private readonly spaces?: SpacesService,
  ) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const conf = await this.expensesService.buildPendingFromMessage(ctx.message, ctx.userId)
    if (!conf) return null
    const { text, payload } = withSpace(conf.text, { items: conf.items }, await resolveSpace(this.spaces, ctx))
    return askToConfirm(this.tokens, ctx, text, 'expense', payload)
  }
}
