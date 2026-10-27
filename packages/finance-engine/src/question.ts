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

/** Plans that live in the future: a trip, a big purchase, saving "for" something. */
const PLAN_WORDS = /\b(viaj|viaje|irme|ir a|comprar|comprarme|juntar|ahorrar|meta|boda|mudarme|estudiar|maestr)/i
/** Spending words: a future-dated message with these is still about spending. */
const SPEND_WORDS = /\b(gast|pagu[eé]|compr[eé])/i

/** "¿y en julio?", "¿el mes pasado?", "ayer": a follow-up that is only a period. */
function isBarePeriodFollowUp(message: string): boolean {
  const words = message.replace(/[¿?¡!.,]/g, ' ').trim().split(/\s+/).filter(Boolean)
  return /^(y|e)$/i.test(words[0] ?? '') || words.length <= 4
}

/**
 * Deterministic reading of a chat question: what is asked (intent), about
 * which dates (period) and which category. No LLM involved.
 */
export function resolveQuestion(message: string, asOf: Date): ResolvedQuestion {
  const period = resolvePeriodRange(message, asOf)
  const classified = classifyIntent(message)
  let intent: FactsIntent = classified
  // "quiero viajar a Japón en enero 2028": a future date with a plan is a goal plan,
  // never a spending question about that (empty) month.
  if (period.future && PLAN_WORDS.test(message) && !SPEND_WORDS.test(message) && classified !== 'goal') {
    intent = 'goal_plan'
  } else if (period.future && (classified === 'other' || classified === 'unknown_finance' || classified === 'spending_summary')) {
    // "¿cuánta plata voy a tener el próximo mes?": a projection, not a summary of an empty month.
    intent = 'forecast'
  } else if (period.explicit && (classified === 'unknown_finance' || (classified === 'other' && isBarePeriodFollowUp(message)))) {
    // "¿y el mes pasado?" / "¿y en julio?": a bare period means a spending summary.
    // "¿quién ganó el partido ayer?" is not about money and stays 'other'.
    intent = 'spending_summary'
  }
  return {
    intent,
    period,
    category: intent === 'category_spend' ? detectCategoryInText(message) : null,
  }
}
