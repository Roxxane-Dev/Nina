import type { FactsPayload } from '../../packages/finance-engine/src'

export type LlmAnswer = {
  message: string
  figuresUsed: string[]
  recommendation?: string
  followUps: string[]
  confidenceNote?: string
}

const PROHIBITED = [
  /compra(r)? acciones/i,
  /te apruebo el cr[eé]dito/i,
  /garantizo/i,
  /inversi[oó]n recomendada/i,
  /asesor[ií]a legal/i,
]

function allowedNumbers(facts: FactsPayload): number[] {
  const nums: number[] = Object.values(facts.figures)
  for (const c of facts.comparisons ?? []) nums.push(c.current, c.baseline)
  for (const i of facts.items ?? []) nums.push(i.amount)
  nums.push(facts.txnCount)
  return nums.map((n) => Number(n))
}

function extractNumbers(text: string): number[] {
  const out: number[] = []
  const re = /(?:S\/\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d+)?)%?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
    const n = Number(raw)
    if (!Number.isNaN(n)) out.push(n)
  }
  return out
}

function closeEnough(a: number, b: number): boolean {
  const tol = Math.max(0.05, Math.abs(b) * 0.005)
  return Math.abs(a - b) <= tol
}

export function parseLlmAnswer(raw: string): LlmAnswer | null {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) return null
  try {
    const obj = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>
    const message = String(obj.message ?? obj.reply ?? '')
    if (!message) return null
    return {
      message,
      figuresUsed: Array.isArray(obj.figures_used) ? obj.figures_used.map(String) : [],
      recommendation: obj.recommendation ? String(obj.recommendation) : undefined,
      followUps: Array.isArray(obj.follow_ups) ? obj.follow_ups.map(String).slice(0, 3) : [],
      confidenceNote: obj.confidence_note ? String(obj.confidence_note) : undefined,
    }
  } catch {
    return null
  }
}

export function validateAnswer(
  answer: LlmAnswer,
  facts: FactsPayload,
): { ok: boolean; reason?: string } {
  const blob = `${answer.message} ${answer.recommendation ?? ''}`
  if (PROHIBITED.some((p) => p.test(blob))) {
    return { ok: false, reason: 'prohibited_advice' }
  }
  if ((facts.confidence === 'low' || facts.confidence === 'insufficient') &&
      /terminar[aá]s|proyect/i.test(blob) &&
      extractNumbers(blob).length > 0) {
    return { ok: false, reason: 'projection_without_confidence' }
  }
  const allowed = allowedNumbers(facts)
  for (const n of extractNumbers(blob)) {
    if (n > 31 && n < 2100) continue
    if (!allowed.some((a) => closeEnough(n, a))) {
      return { ok: false, reason: `ungrounded_number:${n}` }
    }
  }
  return { ok: true }
}

export function templatedAnswer(facts: FactsPayload): LlmAnswer {
  const exp = facts.figures.expenses
  const inc = facts.figures.income
  const message =
    facts.confidence === 'insufficient'
      ? 'Aún no tengo datos suficientes para responder con seguridad. Puedo mostrarte tus gastos de este mes.'
      : `Este periodo registras S/ ${Number(exp ?? 0).toFixed(2)} en gastos y S/ ${Number(inc ?? 0).toFixed(2)} en ingresos.`
  return {
    message,
    figuresUsed: Object.keys(facts.figures),
    followUps: ['¿En qué gasto más?', '¿Cuánto me sobrará este mes?'],
  }
}
