/**
 * Validator for open conversation (CI-01): answers that are not grounded in
 * engine facts may not contain ANY figure. Fail-closed: when in doubt, reject
 * and let the deterministic reply answer instead.
 */
export type OpenAnswer = { message: string; followUps: string[] }

/** Anything that reads as an amount, a quantity or a rate. */
const NUMERIC = [
  { reason: 'digit', re: /\d/ },
  { reason: 'currency', re: /S\/|US\$|\$|€/ },
  { reason: 'percent', re: /%|\bpor ?ciento\b/i },
  {
    reason: 'number_word',
    re: /\b(cien|cientos?|doscient[oa]s|trescient[oa]s|cuatrocient[oa]s|quinient[oa]s|seiscient[oa]s|setecient[oa]s|ochocient[oa]s|novecient[oa]s|mil|miles|mill[oó]n|millones|lucas?|docenas?)\b/i,
  },
]

/** Advice Nina never gives (FR-07) and promises she cannot keep. */
const PROHIBITED = [
  /compra(r)? acciones/i,
  /te apruebo el cr[eé]dito/i,
  /garantiz/i,
  /inversi[oó]n recomendada/i,
  /asesor[ií]a (legal|tributaria)/i,
  /\b(te recomiendo|deber[ií]as|conviene|anímate a) invertir\b/i,
  /\b(compra|comprar|invierte|invertir) (en )?(cripto|bitcoin|criptomonedas|acciones|fondos mutuos|d[oó]lares)\b/i,
  /\b(pide|pedir|saca|sacar|solicita|solicitar) (un |una )?(pr[eé]stamo|cr[eé]dito)\b/i,
  /\b(muevo|transfiero|pago|deposito) (tu|el) (dinero|plata)\b/i,
]

const MAX_MESSAGE = 600
const MAX_FOLLOW_UP = 60

export function validateOpenAnswer(answer: OpenAnswer): { ok: boolean; reason?: string } {
  const message = answer.message.trim()
  if (!message) return { ok: false, reason: 'empty' }
  if (message.length > MAX_MESSAGE) return { ok: false, reason: 'too_long' }
  const blob = [message, ...answer.followUps].join('\n')
  for (const n of NUMERIC) if (n.re.test(blob)) return { ok: false, reason: `numeric_${n.reason}` }
  if (PROHIBITED.some((p) => p.test(blob))) return { ok: false, reason: 'prohibited_advice' }
  // Internal labels or instructions must never reach the user.
  if (/\b(follow_ups|recommendation|untrusted|system prompt|mis instrucciones|estas instrucciones)\b/i.test(blob)) return { ok: false, reason: 'leak' }
  return { ok: true }
}

/** Follow-ups in the user's voice: short, deduplicated, at most three. */
export function cleanFollowUps(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const t = raw.trim()
    if (!t || t.length > MAX_FOLLOW_UP || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out.slice(0, 3)
}
