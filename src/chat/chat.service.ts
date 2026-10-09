import { Injectable, Logger } from '@nestjs/common'
import { AIService, type ProcessMessageOptions } from '../ai/ai.service'
import { MemoryService } from '../memory/memory.service'
import { InsightsService } from '../insights/insights.service'
import {
  ExpensesService,
  detectConfirmIntent,
} from '../expenses/expenses.service'
import { IncomeService } from '../income/income.service'
import { GoalService } from '../goals/goal.service'
import { NinaFinanceEngine } from '../intelligence/nina-finance.engine'
import { buildNinaSystemPrompt } from '../intelligence/nina-chat-prompt'

/**
 * In-memory pending-expense map per user.
 *
 * Key:   userId
 * Value: payload object
 *
 * Cleared on process restart (acceptable for MVP).
 * For multi-instance deployments, replace with a Redis-backed store.
 */
const pendingByUser = new Map<string, any>()

/**
 * ChatService — orchestrates Nina's full conversational pipeline:
 *
 *  1. Pending? → confirm or cancel.
 *  2. Expense message? → parse, resolve via DB, return confirmation (no save yet).
 *  3. Anything else → LLM with semantic memory.
 *
 * After each LLM reply, the exchange is stored as a memory embedding so
 * Nina progressively learns about the user's financial behaviour.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly expensesService: ExpensesService,
    private readonly aiService: AIService,
    private readonly memoryService: MemoryService,
    private readonly insightsService: InsightsService,
    private readonly incomeService: IncomeService,
    private readonly goalService: GoalService,
    private readonly financeEngine: NinaFinanceEngine,
  ) {}

  async handleMessage(
    userId: string,
    message: string,
    aiOptions?: ProcessMessageOptions,
  ): Promise<string> {

    // ── Branch A: pending confirmation exists for this user ───────────────────
    const pending = pendingByUser.get(userId)
    if (pending) {
      const intent = detectConfirmIntent(message)

      if (intent === 'confirm') {
        pendingByUser.delete(userId)

        if (pending.type === 'income') {
          const { result } = await this.incomeService.insertIncome(pending.income, userId)
          this.memoryService.storeExchange(userId, message, result).catch(() => {})
          return result
        }

        if (pending.type === 'goal') {
          const { result } = await this.goalService.insertGoal(pending.goal, userId)
          this.memoryService.storeExchange(userId, message, result).catch(() => {})
          return result
        }

        // expense
        const { result } = await this.expensesService.insertExpenses(pending.items, userId)
        let finalResponse = result

        try {
          const profile = await this.expensesService.updateUserProfile(userId)
          if (profile) {
            const currentDay = new Date().getDate()
            const dailyAvg = currentDay > 0 ? profile.monthly_spending / currentDay : 0
            const items: any[] = pending.items ?? []
            const hasAnomaly = items.some((item: any) => item.amount > dailyAvg * 2)
            const isTopCategory = items.some((item: any) => item.category_name === profile.top_category)
            const isOverBudget = (profile as any).budget_status?.over_budget ?? (profile as any).over_budget

            if (hasAnomaly) {
              finalResponse += '\n\n👀 Ese gasto estuvo pesadito comparado con tu promedio'
              if (isTopCategory && profile.top_category) {
                finalResponse += `\nY por cierto… ${profile.top_category} ya es de tus categorías fuertes 😅`
                this.memoryService.storeMessage(userId, 'pattern', `Usuario suele gastos atípicamente altos en ${profile.top_category}.`).catch(() => {})
              }
            } else if (isOverBudget) {
              finalResponse += '\n\n😅 Vas a superar tu gasto del mes pasado si sigues así'
            } else if (isTopCategory && profile.top_category) {
              finalResponse += `\n\n👀 Últimamente estás gastando mucho en ${profile.top_category}`
            }
          }
        } catch (e) {
          this.logger.warn(`updateUserProfile error: ${e}`)
        }

        this.memoryService.storeExchange(userId, message, finalResponse).catch((e) => this.logger.warn(`storeExchange error: ${e}`))
        return finalResponse
      }

      if (intent === 'cancel') {
        pendingByUser.delete(userId)
        const cancelMsg = 'Entendido, cancelé el registro. ¿Hay algo más en lo que te pueda ayudar?'
        this.memoryService.storeExchange(userId, message, cancelMsg).catch(() => {})
        return cancelMsg
      }

      pendingByUser.delete(userId)
    } else {
      const orphanIntent = detectConfirmIntent(message);
      if (orphanIntent === 'confirm' || orphanIntent === 'cancel') {
        return 'Perdona, me distraje un segundo 😅 ¿Qué gasto ibas a registrar?';
      }
    }

    // ── Branch B: Object-based detection ────────────────────────────────────────
    const incomeConf = await this.incomeService.buildPendingFromMessage(message, userId)
    if (incomeConf) {
      pendingByUser.set(userId, { ...incomeConf, type: 'income' })
      this.memoryService.storeExchange(userId, message, incomeConf.text).catch(() => {})
      return incomeConf.text
    }

    const goalConf = await this.goalService.buildPendingFromMessage(message, userId)
    if (goalConf) {
      pendingByUser.set(userId, { ...goalConf, type: 'goal' })
      this.memoryService.storeExchange(userId, message, goalConf.text).catch(() => {})
      return goalConf.text
    }

    const confirmation = await this.expensesService.buildPendingFromMessage(message, userId)
    if (confirmation) {
      pendingByUser.set(userId, { ...confirmation, type: 'expense' })
      this.memoryService.storeExchange(userId, message, confirmation.text).catch(() => {})
      return confirmation.text
    }

    // ── Branch C: Smart Responses / Insights Heuristic ──────────────────────
    const insights = await this.insightsService.getUserInsights(userId)
    const normalizedMessage = message.toLowerCase()
    
    if (normalizedMessage.includes('en qué gasto más') || normalizedMessage.includes('en que gasto mas')) {
      if (insights?.top_category) {
        return `Estás gastando más en ${insights.top_category} actualmente.`
      }
      return 'Todavía no tienes suficientes gastos registrados para saberlo.'
    }

    if (normalizedMessage.includes('voy bien este mes')) {
      if (insights && insights.forecast_end_of_month !== undefined) {
        return `Vas ${insights.trend === 'up' ? 'por encima' : 'por debajo'} del mes pasado. Proyección: $${insights.forecast_end_of_month.toFixed(2)}`
      }
      return 'Todavía no tienes suficientes gastos registrados para saberlo.'
    }

    // ── Branch D: general AI conversation with semantic memory ────────────────
    let ninaSnapshotPrompt: string | undefined
    try {
      const snap = await this.financeEngine.getSnapshot(userId)
      ninaSnapshotPrompt = buildNinaSystemPrompt(snap, 'Usuario')
    } catch (e) {
      this.logger.warn(`getSnapshot for chat: ${e}`)
    }

    return this.aiService.processMessage(
      {
        message,
        context: 'general',
        insights,
        ninaSnapshotPrompt,
      },
      { ...aiOptions, userId },
    )
  }
}
