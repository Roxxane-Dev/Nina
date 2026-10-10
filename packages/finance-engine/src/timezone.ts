/**
 * The single source of Nina's date convention.
 *
 * Every date the engine works with is a *calendar day in Lima*, represented as
 * midnight UTC of that day (so getUTCFullYear/Month/Date give the Lima day).
 * Nothing else in the codebase should hard-code the time zone or an offset.
 * Pure: uses Intl, never the system clock.
 */
export const APP_TIME_ZONE = 'America/Lima'

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
/**
 * The API writes calendar days ('2026-10-10') into transactions.date, which in
 * the real database is timestamptz, so Postgres stores midnight UTC and returns
 * '2026-10-10T00:00:00+00:00'. Exactly-midnight-UTC values are therefore a
 * calendar day, not an instant; converting them to Lima would shift them to
 * the previous day.
 */
const MIDNIGHT_UTC_DAY = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|[+-]00(?::?00)?)$/

const limaParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Calendar day in Lima for a stored value, as midnight UTC.
 * Accepts 'YYYY-MM-DD' (already a calendar day), ISO timestamps with time and
 * offset ('2026-10-10T00:00:00+00:00', as Supabase returns timestamptz) and Date.
 * Returns null for anything that is not a valid date.
 */
export function toLocalDay(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  if (typeof value === 'string') {
    let trimmed = value.trim()
    const midnight = MIDNIGHT_UTC_DAY.exec(trimmed)
    if (midnight) trimmed = midnight[1]
    const dayOnly = DAY_ONLY.exec(trimmed)
    if (dayOnly) {
      const [, y, m, d] = dayOnly.map(Number)
      const date = new Date(Date.UTC(y, m - 1, d))
      // Reject impossible days like 2026-02-31 (Date would roll them over).
      return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null
    }
    return localDayOf(new Date(trimmed))
  }
  return localDayOf(value)
}

/** Calendar day in Lima of an instant, as midnight UTC. Null if the instant is invalid. */
export function localDayOf(instant: Date): Date | null {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return null
  const [y, m, d] = limaParts.format(instant).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Today's calendar day in Lima for a given instant; throws only on an invalid instant. */
export function localToday(now: Date): Date {
  const day = localDayOf(now)
  if (!day) throw new RangeError('localToday: invalid instant')
  return day
}

export function isValidDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime())
}
