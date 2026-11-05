import { parseAmount } from './goal-plan'

/**
 * HOME-02: "aparté 200 para Japón", "le puse S/ 150 a mi meta viaje". A statement about money the
 * user already set aside, never a question or a plan. Deterministic; the goal is matched against
 * the user's own goals by name.
 */
export type ContributionRequest = {
  amount: number
  currency: 'PEN' | 'USD'
  /** Words after "para / a / en (mi meta)"; empty when the user named no goal. */
  goalText: string
}

const VERB = /\b(?:apart[eé]|separ[eé]|ahorr[eé]|guard[eé]|puse|met[ií]|abon[eé]|agregu[eé]|sum[eé]|deposit[eé])(?![a-záéíóúñ])/
const QUESTION = /\?|\b(?:c[oó]mo|cu[aá]nto|cu[aá]nta|deber[ií]a|puedo|podr[ií]a)\b/
const TARGET = /\b(?:para|a|al|en)\s+(?:la\s+|mi\s+|el\s+|tu\s+)?(?:meta\s+(?:de(?:l)?\s+|llamada\s+)?)?([a-záéíóúñü][a-záéíóúñü ]*)$/

export function parseContributionRequest(message: string): ContributionRequest | null {
  const text = message.trim().toLowerCase().replace(/[.!¡]+$/g, '')
  if (!VERB.test(text) || QUESTION.test(text)) return null
  const amount = parseAmount(text)
  if (!amount) return null
  // Only what comes after the amount names the goal ("aparté 200 para japón").
  const tail = text.replace(/.*?\d[\d.,]*\s*(?:mil|k)?\s*(?:soles?|d[oó]lar(?:es)?|usd|lucas?)?/, ' ').trim()
  const m = TARGET.exec(tail)
  const goalText = m ? m[1].replace(/\b(?:meta|mis?|ahorros?|este|esta|mes|hoy|ayer)\b/g, ' ').replace(/\s+/g, ' ').trim() : ''
  return { amount: amount.amount, currency: amount.usd ? 'USD' : 'PEN', goalText }
}

export type GoalRef = { id: string; name: string }
export type GoalMatch = { goal: GoalRef } | { ambiguous: GoalRef[] } | { none: true }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const IGNORED = new Set(['viaje', 'para', 'meta', 'una', 'uno', 'del', 'los', 'las', 'mis', 'con'])
const words = (s: string) => fold(s).split(/[^a-zñ0-9]+/).filter((w) => w.length >= 3 && !IGNORED.has(w))

/** Which of the user's goals the text names. With no name and a single goal, that goal. */
export function matchGoal(goalText: string, goals: GoalRef[]): GoalMatch {
  if (!goals.length) return { none: true }
  const asked = words(goalText)
  if (!asked.length) return goals.length === 1 ? { goal: goals[0] } : { ambiguous: goals }
  const hits = goals.filter((g) => {
    const name = words(g.name)
    return asked.some((a) => name.some((n) => n.startsWith(a) || a.startsWith(n)))
  })
  if (hits.length === 1) return { goal: hits[0] }
  return hits.length ? { ambiguous: hits } : { none: true }
}

export type GoalProgressQuestion = { all: boolean; goalText: string; mentionsGoal: boolean }

const PROGRESS = /\b(?:c[oó]mo\s+(?:voy|va|van|ando|llevo)|cu[aá]nto\s+(?:llevo|tengo|he\s+juntado|he\s+ahorrado|me\s+falta)|avance|progreso)\b/
const ALL_GOALS = /\bmis\s+metas\b/
const PROGRESS_TARGET = /\b(?:con|en|para|de)\s+(.+)$/

/** INS-05: "¿cómo voy con Japón?" Null for anything else, including plans ("¿cómo alcanzo…?"). */
export function parseGoalProgressQuestion(message: string): GoalProgressQuestion | null {
  const text = message.trim().toLowerCase().replace(/[¿?¡!.]/g, '').replace(/\s+/g, ' ')
  if (!PROGRESS.test(text) || /\d/.test(text)) return null
  const mentionsGoal = /\bmetas?\b/.test(text)
  if (ALL_GOALS.test(text)) return { all: true, goalText: '', mentionsGoal: true }
  const after = text.replace(PROGRESS, ' ').trim()
  const m = PROGRESS_TARGET.exec(after)
  if (!m) return null
  const goalText = m[1].replace(/^(?:mi\s+)?meta\s+(?:de(?:l)?\s+)?/, '').replace(/\s+/g, ' ').trim()
  return goalText ? { all: false, goalText, mentionsGoal } : null
}
