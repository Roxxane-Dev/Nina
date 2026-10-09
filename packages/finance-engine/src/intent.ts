import type { FactsIntent } from './types'

const RULES: Array<{ intent: FactsIntent; patterns: RegExp[] }> = [
  {
    intent: 'spending_breakdown',
    patterns: [/en qu[eé] gasto/i, /gasto m[aá]s/i, /desglose/i, /categor[ií]a/i],
  },
  {
    intent: 'forecast',
    patterns: [/sobr(a|ará|ara)/i, /cierre de mes/i, /proyecci[oó]n/i, /me va a alcanzar/i],
  },
  {
    intent: 'score',
    patterns: [/salud financiera/i, /score/i, /puntaje/i, /c[oó]mo voy/i],
  },
  {
    intent: 'whatif',
    patterns: [/si compro/i, /qu[eé] pasa si/i, /cuotas/i, /me alcanza para/i],
  },
  {
    intent: 'subscriptions',
    patterns: [/suscrip/i, /recurrente/i, /netflix/i, /mensualidad/i],
  },
  {
    intent: 'goal',
    patterns: [/meta/i, /ahorrar/i, /objetivo/i],
  },
]

export function classifyIntent(message: string): FactsIntent {
  const text = message.trim()
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent
  }
  return 'other'
}
