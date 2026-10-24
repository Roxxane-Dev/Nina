import { signedFlows, trailingFullMonths } from './aggregates'
import { isoDate } from './period'
import { monthLabelEs } from './periods'
import { ENGINE_VERSION } from './version'
import type { Confidence, EngineTransaction, FactsPayload } from './types'

export const DEFAULT_USD_PEN_RATE = 3.75

export type GoalRequest = {
  /** Amount exactly as the user wrote it, in `currency`. */
  amount: number
  currency: 'PEN' | 'USD'
  name: string
  /** Last day of the month the user wants to reach the goal; null when no date was given. */
  deadline: { year: number; month: number } | null
  /** The user named a date that is already over (or the current month): it cannot be planned. */
  deadlinePast: boolean
}

const MONTHS: Array<[RegExp, number]> = [
  [/\benero\b/, 0],
  [/\bfebrero\b/, 1],
  [/\bmarzo\b/, 2],
  [/\babril\b/, 3],
  [/\bmayo\b/, 4],
  [/\bjunio\b/, 5],
  [/\bjulio\b/, 6],
  [/\bagosto\b/, 7],
  [/\bset?iembre\b/, 8],
  [/\boctubre\b/, 9],
  [/\bnoviembre\b/, 10],
  [/\bdiciembre\b/, 11],
]
const MONTH_WORDS = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre'

const USD_RE = /\b(?:d[oó]lar(?:es)?|usd|us\$)\b|\$/i
const NUM = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`

function toNumber(raw: string): number {
  // "6,000" / "6.000" are thousands; "12,50" is a decimal.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return parseFloat(raw.replace(/[.,]/g, ''))
  return parseFloat(raw.replace(',', '.'))
}

/** The goal amount in the text. Years, durations ("en 6 meses") and counts are never amounts. */
function parseAmount(text: string): { amount: number; usd: boolean } | null {
  const candidates: Array<{ value: number; marked: boolean; usd: boolean }> = []
  for (const m of text.matchAll(new RegExp(String.raw`(?:(s\/\.?|us\$|\$|usd)\s*)?(${NUM})(?:\s*(mil|k)\b)?(?:\s*(soles?|d[oó]lar(?:es)?|usd|s\/\.?|pesos|lucas?))?`, 'gi'))) {
    const [full, pre, raw, mult, post] = m
    const after = text.slice((m.index ?? 0) + full.length, (m.index ?? 0) + full.length + 12)
    if (/^\s*(meses|mes|a[ñn]os?|d[ií]as|semanas|veces|cuotas)\b/.test(after) && !pre && !post) continue
    let value = toNumber(raw)
    if (mult) value *= 1000
    const marked = Boolean(pre || post)
    // A bare 2000–2100 is a year only right after a preposition or month ("en 2028", "enero 2028").
    const before = text.slice(0, m.index ?? 0).trimEnd()
    const isYear =
      !marked && !mult && Number.isInteger(value) && value >= 2000 && value <= 2100 &&
      new RegExp(String.raw`(?:\b(?:en|para|hasta|el|del|fines|finales)|\b(?:${MONTH_WORDS})(?:\s+de(?:l)?)?)$`).test(before)
    if (isYear || !(value > 0)) continue
    const usd = Boolean((pre && /us\$|\$|usd/i.test(pre)) || (post && /d[oó]lar|usd/i.test(post)))
    candidates.push({ value, marked, usd })
  }
  if (!candidates.length) return null
  const pick = candidates.find((c) => c.marked) ?? candidates[0]
  return { amount: pick.value, usd: pick.usd || (candidates.every((c) => !c.marked) && USD_RE.test(text)) }
}

function parseDeadline(text: string, asOf: Date): { deadline: GoalRequest['deadline']; past: boolean } {
  const y = asOf.getUTCFullYear()
  const m = asOf.getUTCMonth()
  const make = (year: number, month: number) => {
    const diff = (year - y) * 12 + (month - m)
    return diff >= 1 ? { deadline: { year, month }, past: false } : { deadline: null, past: true }
  }

  // "en 6 meses", "en 2 años", "en un año", "en medio año"
  const rel = text.match(/\ben\s+(\d+|un|una|medio|media|dos|tres|cuatro|cinco)\s*(mes(?:es)?|a[ñn]os?)\b/)
  if (rel) {
    const words: Record<string, number> = { un: 1, una: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5 }
    const n = words[rel[1]] ?? parseInt(rel[1], 10)
    const months = Math.round(/mes/.test(rel[2]) ? n : n * 12)
    if (months < 1) return { deadline: null, past: false }
    const t = m + months
    return { deadline: { year: y + Math.floor(t / 12), month: t % 12 }, past: false }
  }

  // "enero 2028", "para diciembre del 2027"
  const withYear = text.match(new RegExp(String.raw`\b(${MONTH_WORDS})\s*(?:de(?:l)?\s+)?(20\d\d)\b`))
  if (withYear) {
    const idx = MONTHS.findIndex(([re]) => re.test(withYear[1]))
    return make(parseInt(withYear[2], 10), idx)
  }
  // "para enero" → next January.
  const bare = text.match(new RegExp(String.raw`\b(?:para|en|hasta|antes de)\s+(?:el\s+)?(?:mes de\s+)?(${MONTH_WORDS})\b`))
  if (bare) {
    const idx = MONTHS.findIndex(([re]) => re.test(bare[1]))
    return make(idx > m ? y : y + 1, idx)
  }
  // "en 2028" → the end of that year.
  const year = text.match(/\b(?:en|para|hasta|el|a fines de|finales de)\s+(?:el\s+)?(20\d\d)\b/)
  if (year) return make(parseInt(year[1], 10), 11)
  return { deadline: null, past: false }
}

const NAME_STOP = new Set(['en', 'para', 'y', 'con', 'de', 'por', 'que', 'pero', 'si', 'al', 'a', 'mi', 'el', 'la', 'un', 'una', 'cual', 'como', 'quiero', 'dime'])
const NAME_NOISE = new Set(['ahorro', 'ahorrar', 'meta', 'plan', 'objetivo', 'dinero', 'plata', 'bolsita'])

function takeWords(source: string, max = 3): string {
  const out: string[] = []
  for (const w of source.split(/\s+/).filter(Boolean)) {
    if (NAME_STOP.has(w) || /\d/.test(w) || new RegExp(`^(${MONTH_WORDS})$`).test(w)) break
    out.push(w)
    if (out.length >= max) break
  }
  return out.join(' ')
}

export function extractGoalName(text: string): string {
  const lower = text.toLowerCase()
  const trip = lower.match(/\b(?:viajar|viaje|ir)\s+a(?:l)?\s+([a-záéíóúñ ]+)/)
  if (trip) {
    const place = takeWords(trip[1], 2)
    if (place && !NAME_NOISE.has(place)) return `Viaje a ${place}`
  }
  const purpose = lower.match(/\bpara\s+(?:comprar\s+|pagar\s+|hacer\s+|mi\s+|el\s+|la\s+|un\s+|una\s+|unas\s+|unos\s+)*([a-záéíóúñ ]+)/)
  if (purpose) {
    const what = takeWords(purpose[1])
    if (what && !NAME_NOISE.has(what) && !new RegExp(`^(${MONTH_WORDS})`).test(what)) return what
  }
  return 'Mi meta'
}

/** Reads a goal ("ahorrar 6000 dólares para viajar a Japón en 2028") deterministically. Null when no amount. */
export function parseGoalRequest(message: string, asOf: Date): GoalRequest | null {
  const text = message.trim().toLowerCase()
  const amount = parseAmount(text)
  if (!amount) return null
  const { deadline, past } = parseDeadline(text, asOf)
  return {
    amount: amount.amount,
    currency: amount.usd ? 'USD' : 'PEN',
    name: extractGoalName(text),
    deadline,
    deadlinePast: past,
  }
}

/** True when the message asks HOW to reach a goal (a plan) instead of declaring one. */
export const GOAL_PLAN_PATTERNS: RegExp[] = [
  /c[oó]mo (alcanzo|llego|logro|consigo|junto|cumplo|completo)/i,
  /c[oó]mo (puedo |podr[ií]a )?(llegar|juntar|alcanzar|lograr)/i,
  /\b(cu[aá]l|que|qu[eé]) (ser[ií]a|es|seria) (mi|el|un) plan/i,
  /\bplan\b.*\b(ahorr|meta|llegar|juntar|alcanzar)/i,
  /\b(ahorr|meta)\b.*\bplan\b/i,
  /cu[aá]nto (tengo que|debo|necesito|hay que|me toca|deber[ií]a) (ahorrar|guardar|apartar|juntar)/i,
  /en cu[aá]nto tiempo (llego|alcanzo|junto|logro|ahorro|puedo)/i,
  /cu[aá]ndo (llego|alcanzo|junto|logro) (a|mi)/i,
]

export function monthsBetween(asOf: Date, deadline: { year: number; month: number }): number {
  return (deadline.year - asOf.getUTCFullYear()) * 12 + (deadline.month - asOf.getUTCMonth())
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * The plan for a goal: what to save per month to arrive on time and whether the user's real
 * savings pace (average of the last full months with data) can do it. All numbers are computed here.
 */
export function buildGoalPlanFacts(input: {
  txs: EngineTransaction[]
  asOf: Date
  goal: GoalRequest
  usdPenRate?: number
}): FactsPayload {
  const { asOf, goal } = input
  const rate = input.usdPenRate ?? DEFAULT_USD_PEN_RATE
  const txs = signedFlows(input.txs)
  const target = goal.currency === 'USD' ? round(goal.amount * rate) : round(goal.amount)

  const months = trailingFullMonths(txs, asOf, 3).filter((mo) => mo.count > 0)
  const hasHistory = txs.length > 0
  const figures: Record<string, number> = { target }
  if (goal.currency === 'USD') {
    figures.target_usd = round(goal.amount)
    figures.usd_pen_rate = rate
  }

  let savingsPace: number | null = null
  if (months.length) {
    const avgIncome = months.reduce((s, mo) => s + mo.income, 0) / months.length
    const avgExpenses = months.reduce((s, mo) => s + mo.expenses, 0) / months.length
    savingsPace = avgIncome - avgExpenses
    figures.avg_income = round(avgIncome)
    figures.avg_expenses = round(avgExpenses)
    figures.avg_monthly_savings = round(savingsPace)
    figures.months_used = months.length
    if (savingsPace > 0) figures.months_at_current_pace = Math.ceil(target / savingsPace)
  }

  let deadlineLabel: string | undefined
  if (goal.deadline) {
    const monthsLeft = monthsBetween(asOf, goal.deadline)
    const perMonth = target / monthsLeft
    deadlineLabel = monthLabelEs(goal.deadline.year, goal.deadline.month)
    figures.months_left = monthsLeft
    figures.required_per_month = round(perMonth)
    if (months.length && figures.avg_income > 0) {
      figures.required_pct_of_income = Math.round((perMonth / figures.avg_income) * 100)
    }
    if (savingsPace !== null) {
      // Positive = per-month shortfall; negative = per-month room to spare.
      figures.gap_per_month = round(perMonth - savingsPace)
    }
  }

  const confidence: Confidence = months.length >= 3 ? 'high' : months.length === 2 ? 'medium' : months.length === 1 ? 'low' : 'insufficient'
  const end = goal.deadline ? new Date(Date.UTC(goal.deadline.year, goal.deadline.month + 1, 0)) : asOf

  return {
    intent: 'goal_plan',
    period: { from: isoDate(asOf), to: isoDate(end) },
    currency: 'PEN',
    figures,
    txnCount: months.reduce((s, mo) => s + mo.count, 0),
    confidence,
    evidenceTxnIds: [],
    engineVersion: ENGINE_VERSION,
    context: {
      periodLabel: deadlineLabel ? `hasta ${deadlineLabel}` : 'sin fecha límite',
      hasHistory,
      categoryLabel: goal.name,
      goalDeadlineLabel: deadlineLabel,
      goalDeadlinePast: goal.deadlinePast || undefined,
    },
  }
}
