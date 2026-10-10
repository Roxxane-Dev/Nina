import { detectCategoryInText } from './categories'
import type { FactsIntent } from './types'

// Order matters: the first matching rule wins.
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
    intent: 'income',
    patterns: [/ingres/i, /cu[aá]nto gan[eéo]/i, /\bsueldo\b/i, /\bsalario\b/i, /me pagaron/i],
  },
  {
    intent: 'available',
    patterns: [/me queda/i, /me sobr/i, /disponible/i, /\bsaldo\b/i, /cu[aá]nto tengo/i, /ahorr[eé] este mes/i],
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
    patterns: [/gast[eéo]/i, /gastos/i, /cu[aá]nto (he )?gastado/i, /resumen/i],
  },
]

const SPEND_WORDS = /gast|pagu[eé]|cu[aá]nto (va|llevo|van)|en qu[eé]/i

export function classifyIntent(message: string): FactsIntent {
  const text = message.trim()
  // "¿cuánto gasté en comida?" → category-specific spend.
  if (SPEND_WORDS.test(text) && detectCategoryInText(text)) return 'category_spend'
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent
  }
  return 'other'
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

export function monthLabelEs(year: number, month: number): string {
  return `${MONTHS_ES[month]} ${year}`
}

/**
 * Period the user asks about. Defaults to the current month.
 * "el mes pasado" → previous month; "en julio" → the latest July not in the future.
 */
export function resolvePeriod(
  message: string,
  asOf: Date,
): { year: number; month: number; explicit: boolean } {
  const text = message.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const y = asOf.getUTCFullYear()
  const m = asOf.getUTCMonth()
  if (/mes (pasado|anterior)/.test(text)) {
    return m === 0 ? { year: y - 1, month: 11, explicit: true } : { year: y, month: m - 1, explicit: true }
  }
  for (let i = 0; i < 12; i++) {
    const name = i === 8 ? '(setiembre|septiembre)' : MONTHS_ES[i]
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      return { year: i > m ? y - 1 : y, month: i, explicit: true }
    }
  }
  return { year: y, month: m, explicit: false }
}
