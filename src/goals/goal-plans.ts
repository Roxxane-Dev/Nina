import {
  buildGoalPlanFacts,
  monthLabelEs,
  monthsBetween,
  type EngineTransaction,
  type GoalRequest,
} from '../../packages/finance-engine/src'

/** A row of `goals` as read with the service-role client (always filtered by user_id). */
export type GoalRow = {
  id: string
  name: string
  target_amount: number | string
  current_amount: number | string | null
  deadline: string | null
  status: string | null
  created_at?: string | null
}

/** What Metas shows for one goal. Every figure comes from the row or from the engine. */
export type GoalView = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  /** target − current, never negative: what is still left to save. */
  remaining: number
  deadline: string | null
  deadlineLabel: string | null
  deadlinePast: boolean
  plan: {
    requiredPerMonth: number | null
    monthsLeft: number | null
    avgMonthlySavings: number | null
    /** Positive = per-month shortfall; negative = room to spare. */
    gapPerMonth: number | null
    confidence: string
  }
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const round = (n: number) => Math.round(n * 100) / 100

/**
 * The plan for an already saved goal: what is left to save per month against the user's real
 * savings pace. The engine plans the remaining amount (target − current), so a goal that is half
 * saved asks for half the effort.
 */
export function goalPlanView(row: GoalRow, txs: EngineTransaction[], asOf: Date): GoalView {
  const targetAmount = round(num(row.target_amount))
  const currentAmount = round(num(row.current_amount))
  const remaining = round(Math.max(0, targetAmount - currentAmount))

  let deadline: GoalRequest['deadline'] = null
  let deadlineLabel: string | null = null
  let deadlinePast = false
  if (row.deadline && /^\d{4}-\d{2}-\d{2}/.test(row.deadline)) {
    const year = Number(row.deadline.slice(0, 4))
    const month = Number(row.deadline.slice(5, 7)) - 1
    deadlineLabel = monthLabelEs(year, month)
    if (monthsBetween(asOf, { year, month }) > 0) deadline = { year, month }
    else deadlinePast = true
  }

  const facts = buildGoalPlanFacts({
    txs,
    asOf,
    goal: { amount: remaining, currency: 'PEN', name: row.name, deadline, deadlinePast },
  })
  const f = facts.figures
  return {
    id: row.id,
    name: row.name,
    targetAmount,
    currentAmount,
    remaining,
    deadline: row.deadline ? row.deadline.slice(0, 10) : null,
    deadlineLabel,
    deadlinePast,
    plan: {
      requiredPerMonth: f.required_per_month ?? null,
      monthsLeft: f.months_left ?? null,
      avgMonthlySavings: f.avg_monthly_savings ?? null,
      gapPerMonth: f.gap_per_month ?? null,
      confidence: facts.confidence,
    },
  }
}
