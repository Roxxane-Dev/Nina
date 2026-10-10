import { detectCategoryInText } from './categories'
import { classifyIntent } from './intent'
import { resolvePeriodRange, type PeriodRange } from './periods'
import type { FactsIntent } from './types'

export type ResolvedQuestion = {
  intent: FactsIntent
  period: PeriodRange
  /** Canonical slug when the question names a category ("¿cuánto gasté en taxis?"). */
  category: string | null
}

/**
 * Deterministic reading of a chat question: what is asked (intent), about
 * which dates (period) and which category. No LLM involved.
 */
export function resolveQuestion(message: string, asOf: Date): ResolvedQuestion {
  const period = resolvePeriodRange(message, asOf)
  const classified = classifyIntent(message)
  // "¿y el mes pasado?" / "¿y en julio?": a bare period means a spending summary.
  const intent = (classified === 'other' || classified === 'unknown_finance') && period.explicit
    ? 'spending_summary'
    : classified
  return {
    intent,
    period,
    category: intent === 'category_spend' ? detectCategoryInText(message) : null,
  }
}
