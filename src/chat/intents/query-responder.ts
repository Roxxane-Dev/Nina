import { Injectable } from '@nestjs/common'
import type { FactsPayload } from '../../../packages/finance-engine/src'
import { NinaRouterService } from '../../nina-router/nina-router.service'
import { buildCard, suggestedFollowUps, type RecentItem } from '../answer-card'
import { reply } from '../chat-reply'
import type { ChatContext, HandlerResult } from './handler'

/** "en octubre 2026", "hoy", "esta semana", "en el año 2026". */
export function periodPhrase(facts: FactsPayload): string {
  const ctx = facts.context
  if (!ctx) return 'en ese periodo'
  return ctx.granularity === 'day' || ctx.granularity === 'week' ? ctx.periodLabel : `en ${ctx.periodLabel}`
}

/**
 * The facts contract for every query: the engine already computed the facts;
 * the LLM only writes the explanation, the validator checks every number, and
 * when that fails the answer is built from the facts alone (template).
 */
@Injectable()
export class QueryResponder {
  constructor(private readonly router: NinaRouterService) {}

  async explain(ctx: ChatContext, facts: FactsPayload, recent?: RecentItem[]): Promise<HandlerResult> {
    const card = buildCard(facts, recent)
    const base = { intent: facts.intent, engineVersion: facts.engineVersion }

    if (facts.intent === 'recent') {
      // A list needs no explanation: no LLM call.
      return {
        outcome: 'ok',
        llmUsed: false,
        validationPassed: true,
        engineVersion: facts.engineVersion,
        reply: reply('Estos son tus últimos movimientos registrados.', {
          card,
          followUps: suggestedFollowUps('recent'),
          grounded: { ...base, validationPassed: true, usedLlm: false },
        }),
      }
    }

    const routed = await this.router.explainFacts(ctx.userId, ctx.message, facts)
    const { answer } = routed
    let text = answer.recommendation ? `${answer.message}\n\n💡 ${answer.recommendation}` : answer.message
    // Said deterministically: the implicit month was empty, so we show the latest month with data.
    const fc = facts.context
    if (routed.usedLlm && fc?.requestedPeriodLabel) {
      text = `En ${fc.requestedPeriodLabel} aún no tienes movimientos; te muestro ${fc.periodLabel}.\n\n${text}`
    }

    return {
      outcome: routed.usedLlm && routed.validationPassed ? 'ok' : 'template_fallback',
      llmUsed: routed.usedLlm,
      validationPassed: routed.validationPassed,
      engineVersion: facts.engineVersion,
      reply: reply(text, {
        card,
        followUps: mergeFollowUps(answer.followUps, suggestedFollowUps(facts.intent)),
        grounded: { ...base, validationPassed: routed.validationPassed, usedLlm: routed.usedLlm },
      }),
    }
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
