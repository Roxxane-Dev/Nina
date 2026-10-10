import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MemoryService } from '../memory/memory.service'
import {
  ExpensesService,
  detectConfirmIntent,
  type ResolvedExpense,
} from '../expenses/expenses.service'
import { IncomeService } from '../income/income.service'
import { GoalService } from '../goals/goal.service'
import { FinanceEngineService } from '../finance-engine/finance-engine.service'
import { NinaRouterService } from '../nina-router/nina-router.service'
import type { ParsedIncome } from '../expenses/income-parser'
import type { ParsedGoal } from '../goals/goal.service'
import {
  ConfirmationTokens,
  confirmationSecret,
  type PendingAction,
  type PendingKind,
} from './confirmation-token'
import {
  HELP_REPLY,
  NO_DATA_REPLY,
  buildCard,
  suggestedFollowUps,
  type AnswerCard,
} from './answer-card'

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

const reply = (text: string, extra: Partial<ChatReply> = {}): ChatReply => ({
  reply: text,
  needsConfirmation: false,
  followUps: [],
  ...extra,
})

const AFTER_SAVE_FOLLOW_UPS = ['¿Cuánto me queda?', '¿Cuánto gasté este mes?', '¿En qué gasto más?']

/**
 * ChatService — Nina's conversational pipeline.
 *
 *  1. "sí" / "no" with a signed pending registration from the app → save or cancel.
 *  2. Registration message (expense / income / goal) → parse and ask to confirm.
 *  3. Question → the engine detects intent, period and category and computes the
 *     facts; NinaRouter asks the LLM to explain them and validates every number.
 *     The result card is built from the facts, never from LLM text.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly tokens: ConfirmationTokens

  constructor(
    private readonly expensesService: ExpensesService,
    private readonly memoryService: MemoryService,
    private readonly incomeService: IncomeService,
    private readonly goalService: GoalService,
    private readonly financeEngine: FinanceEngineService,
    private readonly router: NinaRouterService,
    config: ConfigService,
  ) {
    this.tokens = new ConfirmationTokens(
      confirmationSecret({
        CHAT_CONFIRM_SECRET: config.get<string>('CHAT_CONFIRM_SECRET'),
        SUPABASE_SERVICE_ROLE_KEY: config.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
      }),
    )
  }

  async handleMessage(userId: string, message: string, pendingToken?: string): Promise<ChatReply> {
    const result = await this.route(userId, message, pendingToken)
    this.memoryService
      .storeExchange(userId, message, result.reply)
      .catch((e) => this.logger.warn(`storeExchange failed: ${e instanceof Error ? e.message : e}`))
    return result
  }

  private async route(userId: string, message: string, pendingToken?: string): Promise<ChatReply> {
    // ── 1. Pending confirmation ───────────────────────────────────────────────
    const confirmIntent = detectConfirmIntent(message)
    if (confirmIntent) {
      const pending = this.tokens.verify(pendingToken, userId)
      if (!pending) {
        return reply(
          confirmIntent === 'confirm'
            ? 'No encontré un registro pendiente (pudo haber expirado). Cuéntamelo de nuevo, por ejemplo: "gasté 25 en taxi".'
            : 'Listo, no registré nada. ¿En qué más te ayudo?',
          { followUps: suggestedFollowUps('help') },
        )
      }
      if (confirmIntent === 'cancel') {
        return reply('Entendido, cancelé el registro. ¿Hay algo más en lo que te pueda ayudar?')
      }
      return reply(await this.commit(userId, pending), { followUps: AFTER_SAVE_FOLLOW_UPS })
    }

    // ── 2. Registrations ──────────────────────────────────────────────────────
    const incomeConf = await this.incomeService.buildPendingFromMessage(message, userId)
    if (incomeConf) return this.askToConfirm(userId, incomeConf.text, 'income', { income: incomeConf.income })

    const goalConf = await this.goalService.buildPendingFromMessage(message, userId)
    if (goalConf) return this.askToConfirm(userId, goalConf.text, 'goal', { goal: goalConf.goal })

    const expenseConf = await this.expensesService.buildPendingFromMessage(message, userId)
    if (expenseConf) return this.askToConfirm(userId, expenseConf.text, 'expense', { items: expenseConf.items })

    // ── 3. Grounded answer ────────────────────────────────────────────────────
    const { intent, facts, recent } = await this.financeEngine.factsForQuestion(userId, message)

    if (intent === 'help') {
      return reply(HELP_REPLY, { followUps: suggestedFollowUps('help') })
    }
    if (!facts.context?.hasHistory) {
      return reply(NO_DATA_REPLY, { followUps: suggestedFollowUps('help') })
    }

    const card = buildCard(facts, recent)
    const grounded = { intent, engineVersion: facts.engineVersion }

    if (intent === 'recent') {
      // A list needs no explanation: no LLM call.
      return reply('Estos son tus últimos movimientos registrados.', {
        card,
        followUps: suggestedFollowUps(intent),
        grounded: { ...grounded, validationPassed: true, usedLlm: false },
      })
    }

    const routed = await this.router.explainFacts(userId, message, facts)
    const { answer } = routed
    let text = answer.recommendation ? `${answer.message}\n\n💡 ${answer.recommendation}` : answer.message
    // Said deterministically: the requested month was empty, so we show the latest month with data.
    const ctx = facts.context
    if (routed.usedLlm && ctx?.requestedPeriodLabel) {
      text = `En ${ctx.requestedPeriodLabel} aún no tienes movimientos; te muestro ${ctx.periodLabel}.\n\n${text}`
    }

    return reply(text, {
      card,
      followUps: mergeFollowUps(answer.followUps, suggestedFollowUps(intent)),
      grounded: { ...grounded, validationPassed: routed.validationPassed, usedLlm: routed.usedLlm },
    })
  }

  private askToConfirm(
    userId: string,
    text: string,
    kind: PendingKind,
    payload: Record<string, unknown>,
  ): ChatReply {
    return reply(text, {
      needsConfirmation: true,
      pendingToken: this.tokens.sign(userId, { kind, payload }),
    })
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
      .catch((e) => this.logger.warn(`updateUserProfile failed: ${e instanceof Error ? e.message : e}`))
    return result
  }
}

function mergeFollowUps(fromLlm: string[], defaults: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...fromLlm, ...defaults]) {
    const t = s.trim()
    if (t && t.length <= 60 && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }
  return out.slice(0, 3)
}
