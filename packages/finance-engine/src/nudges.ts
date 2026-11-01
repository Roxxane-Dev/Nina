/**
 * Avisos de Nina (NOTIF-01): deterministic, every figure comes from the engine and no LLM is involved.
 * Each nudge has a stable key per period so a dismissed one stays dismissed until the next period.
 * Voice: playful for everyday spending, calm when money is really tight (then the playful ones are off).
 */
import { negativeOnlyFromSetAside, periodTotals, signedFlows } from './aggregates'
import { detectAnomalies } from './anomaly'
import { categoryLabel } from './categories'
import { isoDate } from './period'
import { monthLabelEs, monthRange } from './periods'
import { detectRecurrence } from './recurrence'
import type { EngineTransaction } from './types'

export type NudgeAction =
  | { type: 'chat'; draft: string }
  | { type: 'add' }
  | { type: 'goals' }
  | { type: 'transactions' }

export type Nudge = {
  key: string
  kind:
    | 'overspent'
    | 'no_income'
    | 'upcoming_payment'
    | 'category_spike'
    | 'subscriptions'
    | 'goal_reached'
    | 'goal_idle'
    | 'christmas'
    | 'weekend'
  tone: 'calm' | 'neutral' | 'positive'
  title: string
  body: string
  action: NudgeAction
}

/** What the nudges need from a goal; the progress comes from the engine (`goalPlanView`). */
export type NudgeGoal = { id: string; name: string; remaining: number; contributedThisMonth: boolean }

export const MAX_NUDGES = 5
const UPCOMING_DAYS = 3
const NO_INCOME_FROM_DAY = 5
const GOAL_IDLE_FROM_DAY = 10
const DAY_MS = 86_400_000

const round = (n: number) => Math.round(n * 100) / 100
const soles = (n: number) =>
  `${n < 0 ? '-' : ''}S/ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase())

/** The goal received a contribution in the month of `asOf`. */
export function contributedInMonth(txs: EngineTransaction[], goalId: string, asOf: Date): boolean {
  const month = isoDate(asOf).slice(0, 7)
  return signedFlows(txs).some((t) => t.goalId === goalId && t.amount < 0 && isoDate(t.postedAt).startsWith(month))
}

export function buildNudges(input: { txs: EngineTransaction[]; asOf: Date; goals: NudgeGoal[] }): Nudge[] {
  const { asOf, goals } = input
  const txs = signedFlows(input.txs)
  if (!txs.length) return []

  const year = asOf.getUTCFullYear()
  const month = asOf.getUTCMonth()
  const day = asOf.getUTCDate()
  const monthKey = isoDate(asOf).slice(0, 7)
  const label = monthLabelEs(year, month)
  const range = monthRange(year, month, asOf, true)
  const now = periodTotals(txs, range.from, range.to)
  const available = round(now.income - now.expenses - now.setAside)
  const calmNegative = negativeOnlyFromSetAside(available, now.setAside)
  const overspent = available < 0 && !calmNegative

  const out: Nudge[] = []

  if (overspent) {
    out.push({
      key: `overspent:${monthKey}`,
      kind: 'overspent',
      tone: 'calm',
      title: 'Este mes salió más de lo que entró',
      body: `Vas en ${soles(available)} en ${label}. Vamos paso a paso: si quieres, revisamos en qué se fue.`,
      action: { type: 'chat', draft: '¿En qué gasto más?' },
    })
  }

  // Only for someone who has registered income before: a new user is not "missing" anything.
  if (now.income === 0 && day >= NO_INCOME_FROM_DAY && txs.some((t) => t.amount > 0 && !t.goalId)) {
    out.push({
      key: `no_income:${monthKey}`,
      kind: 'no_income',
      tone: 'neutral',
      title: 'Falta tu ingreso del mes',
      body: `Todavía no registras ingresos en ${label}. Sin eso, tus números salen a medias.`,
      action: { type: 'add' },
    })
  }

  for (const r of detectRecurrence(txs, asOf)) {
    const days = Math.round((r.nextExpected.getTime() - asOf.getTime()) / DAY_MS)
    if (days < 0 || days > UPCOMING_DAYS || r.confidence < 0.5) continue
    const name = titleCase(r.merchantNormalized)
    const when = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`
    out.push({
      key: `upcoming:${r.merchantNormalized.slice(0, 40)}:${monthKey}`,
      kind: 'upcoming_payment',
      tone: 'neutral',
      title: `Se viene ${name}`,
      body: `Por lo que has registrado, toca ${when}: unos ${soles(r.typicalAmount)}.`,
      action: { type: 'transactions' },
    })
    break
  }

  const spike = detectAnomalies(txs, asOf).spikes.sort((a, b) => b.impact - a.impact)[0]
  if (spike && !overspent) {
    const cat = categoryLabel(spike.categorySlug)
    out.push({
      key: `spike:${spike.categorySlug}:${monthKey}`,
      kind: 'category_spike',
      tone: 'neutral',
      title: `${cat} anda movida este mes`,
      body: `Llevas ${soles(round(spike.current))}, unos ${soles(round(spike.impact))} más de lo normal a esta altura. Audaz. ¿Lo vemos?`,
      action: { type: 'chat', draft: `¿Cuánto gasté en ${cat.toLowerCase()} este mes?` },
    })
  }

  const subs = now.byCategory.subscriptions ?? 0
  if (subs > 0 && !overspent) {
    out.push({
      key: `subscriptions:${monthKey}`,
      kind: 'subscriptions',
      tone: 'neutral',
      title: 'Hablemos de tus suscripciones',
      body: `Llevas ${soles(round(subs))} en suscripciones este mes. ¿Seguro que las estás usando todas?`,
      action: { type: 'chat', draft: '¿Cuánto gasté en suscripciones este mes?' },
    })
  }

  const reached = goals.find((g) => g.remaining <= 0)
  if (reached) {
    out.push({
      key: `goal_reached:${reached.id}`,
      kind: 'goal_reached',
      tone: 'positive',
      title: '¡Lograste tu meta!',
      body: `"${reached.name}" está completa. Eso se llama disciplina.`,
      action: { type: 'goals' },
    })
  }

  const idle = goals.find((g) => g.remaining > 0 && !g.contributedThisMonth)
  if (idle && day >= GOAL_IDLE_FROM_DAY && !overspent) {
    out.push({
      key: `goal_idle:${idle.id}:${monthKey}`,
      kind: 'goal_idle',
      tone: 'neutral',
      title: `¿Y "${idle.name}"?`,
      body: `Este mes todavía no le apartas nada. Si ya lo hiciste, anótalo y lo sumo.`,
      action: { type: 'goals' },
    })
  }

  if (month === 11 && day <= 24 && !overspent) {
    const left = 25 - day
    out.push({
      key: `christmas:${year}`,
      kind: 'christmas',
      tone: 'neutral',
      title: `Faltan ${left} días para Navidad`,
      body: '¿Ya pensaste en los regalos? ¿Quieres que lo presupuestemos?',
      action: { type: 'chat', draft: 'Quiero juntar para los regalos de Navidad ' },
    })
  }

  // Friday, Saturday and Sunday share one key, so a dismissed weekend stays dismissed.
  const weekday = asOf.getUTCDay()
  if ((weekday === 5 || weekday === 6 || weekday === 0) && available > 0) {
    const friday = new Date(asOf.getTime() - ((weekday + 2) % 7) * DAY_MS)
    out.push({
      key: `weekend:${isoDate(friday)}`,
      kind: 'weekend',
      tone: 'neutral',
      title: 'Es fin de semana y el cuerpo lo sabe',
      body: `Tienes ${soles(available)} disponibles este mes. Tú decides cuánto entra en el plan 👀`,
      action: { type: 'chat', draft: '¿Cuánto me queda este mes?' },
    })
  }

  return out
}
