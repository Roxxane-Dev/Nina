import type { FactsPayload } from '../../packages/finance-engine/src'
import { formatSoles } from '../common/money'

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
  nums.push(facts.txnCount, facts.items?.length ?? 0)
  return nums.map((n) => Number(n))
}

const MONTHS = '(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*'
// Calendar references are not financial figures: '15 de octubre', '15 oct', '15/10', '2026'.
const DATE_PATTERNS = [
  new RegExp(`\\b\\d{1,2}\\s+(?:de\\s+)?${MONTHS}\\b`, 'gi'),
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
  /(?<!S\/\s?)\b20\d{2}\b(?![.,]\d)/g,
]

/** Parses '1,250.50', '1.250,50', '1250.5', '38' into a number. */
export function parseLocaleNumber(raw: string): number {
  const lastDot = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')
  let normalized: string
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandSep = decimalSep === '.' ? ',' : '.'
    normalized = raw.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const parts = raw.split(sep)
    const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
    normalized = isThousands ? parts.join('') : parts.join('.')
  } else {
    normalized = raw
  }
  return Number(normalized)
}

export function extractNumbers(text: string): number[] {
  let cleaned = text
  for (const re of DATE_PATTERNS) cleaned = cleaned.replace(re, ' ')
  const out: number[] = []
  const re = /\d+(?:[.,]\d+)*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned))) {
    const n = parseLocaleNumber(m[0])
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
    if (!allowed.some((a) => closeEnough(n, a))) {
      return { ok: false, reason: `ungrounded_number:${n}` }
    }
  }
  return { ok: true }
}

/**
 * Engine-only answer used when no LLM is available or validation fails twice.
 * Every number comes straight from FACTS.
 */
export function templatedAnswer(facts: FactsPayload): LlmAnswer {
  const f = facts.figures
  const ctx = facts.context
  const period = ctx?.periodLabel ? `en ${ctx.periodLabel}` : 'este periodo'
  const prefix = ctx?.requestedPeriodLabel
    ? `En ${ctx.requestedPeriodLabel} aún no tienes movimientos; te muestro ${ctx.periodLabel}. `
    : ''
  const top = facts.items?.[0]
  let message: string

  if (ctx && !ctx.hasHistory) {
    message = 'Aún no tienes movimientos registrados. Cuéntame uno, por ejemplo: "gasté 25 en taxi".'
  } else if (facts.intent === 'income') {
    message = `${prefix}Tus ingresos ${period} suman ${formatSoles(f.income)}.`
  } else if (facts.intent === 'available') {
    message = `${prefix}${cap(period)} ingresaste ${formatSoles(f.income)} y gastaste ${formatSoles(f.expenses)}: te quedan ${formatSoles(f.available)}.`
  } else if (facts.intent === 'category_spend' && ctx?.categoryLabel) {
    message = `${prefix}${cap(period)} gastaste ${formatSoles(f.category_spend ?? 0)} en ${ctx.categoryLabel}; el mes anterior fueron ${formatSoles(f.category_prev ?? 0)}.`
  } else {
    message =
      `${prefix}${cap(period)} gastaste ${formatSoles(f.expenses)} e ingresaste ${formatSoles(f.income)}.` +
      (top ? ` Tu mayor gasto fue ${top.label} con ${formatSoles(top.amount)}.` : '')
  }

  return { message, figuresUsed: Object.keys(f), followUps: [] }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
