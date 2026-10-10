/**
 * Relative date ranges in Spanish ("hoy", "esta semana", "el mes pasado",
 * "en el año", "en julio"…). The one place that turns words into dates.
 *
 * All dates are Lima calendar days as midnight UTC (see timezone.ts); `asOf`
 * must already be such a day. Pure: no clock.
 */
import { endOfMonth } from './period'

export type PeriodGranularity = 'day' | 'week' | 'month' | 'year'

export type PeriodRange = {
  /** First day, inclusive. */
  from: Date
  /** Last day, inclusive (never after asOf for the current period). */
  to: Date
  granularity: PeriodGranularity
  /** Spanish label used in answers: "octubre 2026", "esta semana", "el año 2026". */
  label: string
  /** False when the user named no period and we defaulted to the current month. */
  explicit: boolean
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
const DAY_MS = 86_400_000

export function monthLabelEs(year: number, month: number): string {
  return `${MONTHS_ES[month]} ${year}`
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS)
const minDate = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b)

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Calendar month; the current month ends at asOf. */
export function monthRange(year: number, month: number, asOf: Date, explicit = true): PeriodRange {
  const from = utc(year, month, 1)
  return { from, to: minDate(endOfMonth(from), asOf), granularity: 'month', label: monthLabelEs(year, month), explicit }
}

function yearRange(year: number, asOf: Date, label: string): PeriodRange {
  return { from: utc(year, 0, 1), to: minDate(utc(year, 11, 31), asOf), granularity: 'year', label, explicit: true }
}

/** Monday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7 // Monday = 0
  return addDays(d, -dow)
}

export function resolvePeriodRange(text: string, asOf: Date): PeriodRange {
  const t = fold(text)
  const y = asOf.getUTCFullYear()
  const m = asOf.getUTCMonth()

  if (/\bhoy\b/.test(t)) {
    return { from: asOf, to: asOf, granularity: 'day', label: 'hoy', explicit: true }
  }
  if (/\bayer\b/.test(t)) {
    const d = addDays(asOf, -1)
    return { from: d, to: d, granularity: 'day', label: 'ayer', explicit: true }
  }
  if (/semana (pasada|anterior)|ultima semana/.test(t)) {
    const from = addDays(startOfWeek(asOf), -7)
    return { from, to: addDays(from, 6), granularity: 'week', label: 'la semana pasada', explicit: true }
  }
  if (/esta semana|\bla semana\b|en la semana/.test(t)) {
    return { from: startOfWeek(asOf), to: asOf, granularity: 'week', label: 'esta semana', explicit: true }
  }
  if (/\bano (pasado|anterior)\b/.test(t)) {
    return yearRange(y - 1, asOf, `el año ${y - 1}`)
  }
  if (/\b(este|el|del|en el|en lo que va del) ano\b/.test(t)) {
    return yearRange(y, asOf, `el año ${y}`)
  }
  if (/mes (pasado|anterior)|ultimo mes/.test(t)) {
    return m === 0 ? monthRange(y - 1, 11, asOf) : monthRange(y, m - 1, asOf)
  }
  for (let i = 0; i < 12; i++) {
    const name = i === 8 ? '(setiembre|septiembre)' : MONTHS_ES[i]
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      return monthRange(i > m ? y - 1 : y, i, asOf)
    }
  }
  if (/este mes|\bel mes\b|en el mes/.test(t)) {
    return monthRange(y, m, asOf, true)
  }
  return monthRange(y, m, asOf, false)
}

/**
 * The equivalent preceding period, with the same span, for fair comparisons:
 * Oct 1–9 → Sep 1–9; a full month → the previous full month; Jan 1–Oct 9 →
 * Jan 1–Oct 9 of the previous year; a week → the previous week.
 */
export function previousRange(r: PeriodRange): PeriodRange {
  const spanDays = Math.round((r.to.getTime() - r.from.getTime()) / DAY_MS)
  switch (r.granularity) {
    case 'day': {
      const d = addDays(r.from, -1)
      return { ...r, from: d, to: d, label: 'el día anterior' }
    }
    case 'week': {
      const from = addDays(r.from, -7)
      return { ...r, from, to: addDays(from, spanDays), label: 'la semana anterior' }
    }
    case 'month': {
      const py = r.from.getUTCMonth() === 0 ? r.from.getUTCFullYear() - 1 : r.from.getUTCFullYear()
      const pm = (r.from.getUTCMonth() + 11) % 12
      const from = utc(py, pm, 1)
      const to = minDate(endOfMonth(from), addDays(from, spanDays))
      return { ...r, from, to, label: monthLabelEs(py, pm) }
    }
    case 'year': {
      const py = r.from.getUTCFullYear() - 1
      const from = utc(py, 0, 1)
      return { ...r, from, to: minDate(utc(py, 11, 31), addDays(from, spanDays)), label: `el año ${py}` }
    }
  }
}
