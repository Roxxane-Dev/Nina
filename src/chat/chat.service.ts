import { Injectable, Logger } from '@nestjs/common'
import { classifyIntent } from '../../packages/finance-engine/src'
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
import { PendingActionsStore } from './pending-actions.store'

export type ChatReply = {
  reply: string
  /** True when Nina asks the user to confirm a registration (show Sí / No). */
  needsConfirmation: boolean
  followUps: string[]
  /** Present for answers built from engine facts. */
  grounded?: { intent: string; validationPassed: boolean; usedLlm: boolean; engineVersion: string }
}

const reply = (text: string, extra: Partial<ChatReply> = {}): ChatReply => ({
  reply: text,
  needsConfirmation: false,
  followUps: [],
  ...extra,
})

/**
 * ChatService — Nina's conversational pipeline.
 *
 *  1. Pending confirmation? → confirm (save) or cancel.
 *  2. Registration message (expense / income / goal)? → parse and ask to confirm.
 *  3. Anything else → grounded answer: the finance engine computes the facts,
 *     NinaRouter asks the LLM to explain them and validates every number.
 *
 * Pending confirmations are persisted (chat_pending_actions), not kept in memory.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly expensesService: ExpensesService,
    private readonly memoryService: MemoryService,
    private readonly incomeService: IncomeService,
    private readonly goalService: GoalService,
    private readonly financeEngine: FinanceEngineService,
    private readonly router: NinaRouterService,
    private readonly pending: PendingActionsStore,
  ) {}

  async handleMessage(userId: string, message: string): Promise<ChatReply> {
    const result = await this.route(userId, message)
    this.memoryService
      .storeExchange(userId, message, result.reply)
      .catch((e) => this.logger.warn(`storeExchange failed: ${e instanceof Error ? e.message : e}`))
    return result
  }

  private async route(userId: string, message: string): Promise<ChatReply> {
    // ── 1. Pending confirmation ───────────────────────────────────────────────
    const pending = await this.pending.get(userId)
    const confirmIntent = detectConfirmIntent(message)

    if (pending) {
      if (confirmIntent === 'confirm') {
        await this.pending.clear(userId)
        return reply(await this.commit(userId, pending.kind, pending.payload))
      }
      if (confirmIntent === 'cancel') {
        await this.pending.clear(userId)
        return reply('Entendido, cancelé el registro. ¿Hay algo más en lo que te pueda ayudar?')
      }
      // Any other message drops the stale confirmation and is handled normally.
      await this.pending.clear(userId)
    } else if (confirmIntent === 'confirm' || confirmIntent === 'cancel') {
      return reply('No tengo ningún registro pendiente. ¿Qué gasto o ingreso quieres anotar?')
    }

    // ── 2. Registrations ──────────────────────────────────────────────────────
    const incomeConf = await this.incomeService.buildPendingFromMessage(message, userId)
    if (incomeConf) {
      await this.pending.set(userId, { kind: 'income', payload: { income: incomeConf.income } })
      return reply(incomeConf.text, { needsConfirmation: true })
    }

    const goalConf = await this.goalService.buildPendingFromMessage(message, userId)
    if (goalConf) {
      await this.pending.set(userId, { kind: 'goal', payload: { goal: goalConf.goal } })
      return reply(goalConf.text, { needsConfirmation: true })
    }

    const expenseConf = await this.expensesService.buildPendingFromMessage(message, userId)
    if (expenseConf) {
      await this.pending.set(userId, { kind: 'expense', payload: { items: expenseConf.items } })
      return reply(expenseConf.text, { needsConfirmation: true })
    }

    // ── 3. Grounded answer ────────────────────────────────────────────────────
    const intent = classifyIntent(message)
    const facts = await this.financeEngine.factsForIntent(userId, intent)
    const routed = await this.router.explainFacts(userId, message, facts)
    const { answer } = routed
    const text = answer.recommendation
      ? `${answer.message}\n\n${answer.recommendation}`
      : answer.message

    return reply(text, {
      followUps: answer.followUps,
      grounded: {
        intent,
        validationPassed: routed.validationPassed,
        usedLlm: routed.usedLlm,
        engineVersion: facts.engineVersion,
      },
    })
  }

  private async commit(
    userId: string,
    kind: 'expense' | 'income' | 'goal',
    payload: Record<string, unknown>,
  ): Promise<string> {
    if (kind === 'income') {
      return (await this.incomeService.insertIncome(payload.income as ParsedIncome, userId)).result
    }
    if (kind === 'goal') {
      return (await this.goalService.insertGoal(payload.goal as ParsedGoal, userId)).result
    }
    const { result } = await this.expensesService.insertExpenses(
      payload.items as ResolvedExpense[],
      userId,
    )
    // Keeps user_profiles fresh for the nightly job's user list.
    this.expensesService
      .updateUserProfile(userId)
      .catch((e) => this.logger.warn(`updateUserProfile failed: ${e instanceof Error ? e.message : e}`))
    return result
  }
}
