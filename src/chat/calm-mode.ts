/**
 * Calm mode (PRD-VOX-02): a deterministic keyword rule, never an LLM decision.
 * When a message is about debt, losing income or distress, Nina drops humor
 * and emoji: data questions are answered from the engine template only, and
 * everything else gets a fixed, supportive reply with one concrete next step.
 */
export type CalmKind = 'debt' | 'income_loss' | 'distress'

/** Lowercase, accents removed, so "Perdí mi trabajo" matches "perdi mi trabajo". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const DISTRESS = [
  /\bno puedo mas\b/,
  /\bdesesperad[oa]\b/,
  /\bdesesperacion\b/,
  /\bangustia\b/,
  /\bangustiad[oa]\b/,
  /\bansiedad\b/,
  /\bagobiad[oa]\b/,
  /\bmuy estresad[oa]\b/,
  /\bquiero morir/,
  /\bme quiero morir\b/,
  /\bno quiero vivir\b/,
  /\bhacerme dano\b/,
  /\bsuicid/,
  /\bquitarme la vida\b/,
  /\bacabar con (todo|mi vida)\b/,
  /\bno quiero seguir (viviendo|asi)\b/,
  /\bya no quiero seguir\b/,
  /\bno tengo salida\b/,
  /\bno le veo (salida|sentido)\b/,
]

const DEBT = [
  /\bdeudas?\b/,
  /\bendeudad[oa]\b/,
  /\bsobreendeudad[oa]\b/,
  /\bcobranzas?\b/,
  /\bme estan cobrando\b/,
  /\bno puedo pagar\b/,
  /\ben mora\b/,
  /\binfocorp\b/,
  /\bcentrales? de riesgo\b/,
  /\bme (van a )?embarg(ar|aron)\b/,
]

const INCOME_LOSS = [
  /\bme despidieron\b/,
  /\bme botaron\b/,
  /\bme quede sin (trabajo|empleo|chamba)\b/,
  /\bperdi mi (trabajo|empleo|chamba)\b/,
  /\bsin (trabajo|empleo|chamba)\b/,
  /\bdesemplead[oa]\b/,
  /\bdesempleo\b/,
  /\bme (recortaron|bajaron|quitaron) el sueldo\b/,
]

export function detectCalmTopic(message: string): CalmKind | null {
  const text = fold(message)
  if (DISTRESS.some((re) => re.test(text))) return 'distress'
  if (DEBT.some((re) => re.test(text))) return 'debt'
  if (INCOME_LOSS.some((re) => re.test(text))) return 'income_loss'
  return null
}

/**
 * The one place that holds the crisis resource. The reply below and the system
 * prompt (chat-prompt.ts) both build from this constant; do not copy it.
 * No menu option is hard-coded on purpose.
 */
export const DISTRESS_HELPLINE = 'Línea 113 del Minsa, salud mental (gratuita, las 24 horas)'

/** Final distress reply (founder-approved text). */
export const DISTRESS_REPLY = `Gracias por contármelo. No tienes que resolver todo hoy. Si sientes que esto te supera o piensas en hacerte daño, llama ahora a la ${DISTRESS_HELPLINE}. Aquí sigo, con calma, cuando quieras ver los números.`

/** Fixed replies: no jokes, no emoji, one concrete next step. */
export const CALM_REPLIES: Record<CalmKind, { reply: string; followUps: string[] }> = {
  debt: {
    reply:
      'Entiendo que esto pesa. Vamos paso a paso: primero lo urgente. Puedo mostrarte cuánto has gastado y cuánto te queda según tus movimientos registrados.',
    followUps: ['¿Cuánto me queda?', '¿En qué gasto más?'],
  },
  income_loss: {
    reply:
      'Lamento lo de tu trabajo. Lo primero es ver con claridad dónde estás. Puedo mostrarte cuánto has gastado y cuánto te queda según tus movimientos registrados. Sin apuro.',
    followUps: ['¿Cuánto me queda?', '¿En qué gasto más?'],
  },
  distress: {
    reply: DISTRESS_REPLY,
    followUps: ['¿Cuánto me queda?'],
  },
}

/** Opening line when a data question is answered in calm mode. */
export const CALM_PREFIX = 'Vamos con calma.'

/** Removes emoji and pictographs; used on anything an LLM could have produced. */
export function stripEmoji(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/[ \t]{2,}/g, ' ').trim()
}
