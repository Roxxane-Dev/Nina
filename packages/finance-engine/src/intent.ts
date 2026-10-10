import { detectCategoryInText } from './categories'
import type { FactsIntent } from './types'

// Order matters: the first matching rule wins. Periods ("hoy", "el año"…) are
// resolved separately in periods.ts and never decide the intent.
const RULES: Array<{ intent: FactsIntent; patterns: RegExp[] }> = [
  {
    intent: 'help',
    patterns: [/qu[eé] puedes hacer/i, /c[oó]mo funcionas/i, /qu[eé] sabes hacer/i, /^\s*ayuda\s*\??$/i, /^\s*(hola|buenas|hey)\b[\s!.?]*$/i],
  },
  {
    intent: 'recent',
    patterns: [/[uú]ltimos (gastos|movimientos|ingresos)/i, /mis movimientos/i, /qu[eé] (he )?registrad/i, /historial/i, /lista de (mis )?gastos/i],
  },
  {
    intent: 'whatif',
    patterns: [/si compro/i, /qu[eé] pasa si/i, /en cuotas/i, /me alcanza para/i],
  },
  {
    // Historical balance: all incomes − all expenses registered.
    intent: 'balance',
    patterns: [/\bsaldo\b/i, /cu[aá]nto (dinero |plata )?tengo\b/i, /mi balance/i],
  },
  {
    intent: 'income',
    patterns: [/ingres/i, /cu[aá]nto gan[eéo]/i, /\bsueldo\b/i, /\bsalario\b/i, /me pagaron/i],
  },
  {
    intent: 'available',
    patterns: [/me queda/i, /me sobr/i, /disponible/i, /ahorr[eé] este mes/i],
  },
  {
    intent: 'forecast',
    patterns: [/cierre de mes/i, /fin de mes/i, /proyecci[oó]n/i, /me va a alcanzar/i, /voy a terminar/i],
  },
  {
    intent: 'score',
    patterns: [/salud financiera/i, /\bscore\b/i, /puntaje/i, /c[oó]mo voy/i, /c[oó]mo estoy/i],
  },
  {
    intent: 'subscriptions',
    patterns: [/suscrip/i, /recurrente/i, /mensualidad/i, /pagos fijos/i],
  },
  {
    intent: 'goal',
    patterns: [/\bmeta/i, /objetivo/i, /c[oó]mo (puedo )?ahorrar/i],
  },
  {
    intent: 'spending_breakdown',
    patterns: [/en qu[eé] gasto/i, /gasto m[aá]s/i, /desglose/i, /por categor[ií]a/i, /a d[oó]nde se va/i],
  },
  {
    intent: 'spending_summary',
    patterns: [/gast[eéo]/i, /gastos/i, /gastad/i, /cu[aá]nto (he )?gastado/i, /resumen/i],
  },
]

const SPEND_WORDS = /gast|pagu[eé]|cu[aá]nto (va|llevo|van)|en qu[eé]/i

/** Money vocabulary: a message with these words that matched no rule is a finance question we did not understand. */
const FINANCE_WORDS = /plata|dinero|gast|ingres|saldo|ahorr|presupuesto|deuda|cuenta|tarjeta|\bsoles?\b|\bs\/|pagu|pago|cobr|finanz/i

export function classifyIntent(message: string): FactsIntent {
  const text = message.trim()
  // "¿cuánto gasté en comida?" → category-specific spend.
  if (SPEND_WORDS.test(text) && detectCategoryInText(text)) return 'category_spend'
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent
  }
  return FINANCE_WORDS.test(text) ? 'unknown_finance' : 'other'
}
