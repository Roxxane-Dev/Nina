import { Injectable } from '@nestjs/common'
import { matchGoal, parseGoalProgressQuestion } from '../../../packages/finance-engine/src'
import { formatSoles } from '../../common/money'
import { FinanceEngineService } from '../../finance-engine/finance-engine.service'
import { GoalService } from '../../goals/goal.service'
import { goalPlanView, type GoalView } from '../../goals/goal-plans'
import { reply } from '../chat-reply'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'

const MAX_GOALS_LISTED = 5

/** One goal, said plainly. Every figure comes from goalPlanView (the engine). */
export function goalProgressText(g: GoalView): string {
  if (g.remaining <= 0) return `"${g.name}": ¡ya la lograste! Llevas ${formatSoles(g.currentAmount)} 🎉`
  const head = `"${g.name}": llevas ${formatSoles(g.currentAmount)} de ${formatSoles(g.targetAmount)} (${g.progressPct}%). Te faltan ${formatSoles(g.remaining)}.`
  const p = g.plan
  if (g.deadlinePast) return `${head} La fecha que pusiste ya pasó: dime una nueva y rehago el plan.`
  if (!g.deadlineLabel) return `${head} No tiene fecha: dime para cuándo y te digo cuánto apartar al mes.`
  if (p.requiredPerMonth === null) return head
  const need = ` Para ${g.deadlineLabel} necesitas ${formatSoles(p.requiredPerMonth)} al mes`
  if (p.avgMonthlySavings === null || p.gapPerMonth === null) return `${head}${need}.`
  return p.gapPerMonth > 0
    ? `${head}${need}; tu ahorro real es ${formatSoles(p.avgMonthlySavings)}, así que te faltan ${formatSoles(p.gapPerMonth)} al mes.`
    : `${head}${need} y tu ahorro real es ${formatSoles(p.avgMonthlySavings)}: vas en ritmo 💪`
}

/** INS-05: "¿cómo voy con Japón?", "¿cuánto llevo para la laptop?", "¿cómo van mis metas?". Deterministic, no LLM. */
@Injectable()
export class GoalProgressHandler implements ChatIntentHandler {
  readonly name = 'goal_progress'
  constructor(private readonly goals: GoalService, private readonly engine: FinanceEngineService) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const q = parseGoalProgressQuestion(ctx.message)
    if (!q) return null
    const rows = await this.goals.listActive(ctx.userId)
    if (!rows.length) {
      // Only a question that is clearly about goals gets this answer; anything else is not ours.
      if (!q.mentionsGoal) return null
      return {
        outcome: 'ok',
        reply: reply('Todavía no tienes metas. Crea una y te sigo el paso, por ejemplo: "quiero ahorrar 2000 para un viaje".', {
          followUps: ['Quiero ahorrar para algo'],
        }),
      }
    }
    const pick = q.all ? null : matchGoal(q.goalText, rows.map((r) => ({ id: r.id, name: r.name })))
    if (pick && 'none' in pick && !q.mentionsGoal) return null
    const txs = await this.engine.loadTransactions(ctx.userId)
    const views = rows.map((r) => goalPlanView(r, txs, ctx.asOf))

    let chosen: GoalView[]
    if (!pick || 'ambiguous' in pick) chosen = pick && 'ambiguous' in pick ? views.filter((v) => pick.ambiguous.some((a) => a.id === v.id)) : views
    else if ('goal' in pick) chosen = views.filter((v) => v.id === pick.goal.id)
    else {
      return {
        outcome: 'ok',
        reply: reply(`No encontré esa meta. Tus metas son: ${rows.map((r) => `"${r.name}"`).join(', ')}.`, {
          followUps: rows.slice(0, 3).map((r) => `¿Cómo voy con ${r.name}?`),
        }),
      }
    }
    const shown = chosen.slice(0, MAX_GOALS_LISTED)
    const text = shown.map(goalProgressText).join('\n\n')
    const first = shown[0]
    return {
      outcome: 'ok',
      reply: reply(text, {
        followUps:
          shown.length === 1 && first.remaining > 0
            ? [`Aparté 100 para ${first.name}`, `¿Cómo junto ${formatSoles(first.remaining)} para ${first.name}?`]
            : ['¿Cuánto me queda este mes?'],
      }),
    }
  }
}
