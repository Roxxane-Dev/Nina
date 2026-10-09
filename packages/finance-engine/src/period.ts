export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()))
}

export function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
  return Math.round(ms / 86_400_000)
}

export function dayOfMonthCutoff(asOf: Date, year: number, month: number): Date {
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(asOf.getUTCDate(), dim)
  return new Date(Date.UTC(year, month, day))
}

export function inPeriod(postedAt: Date, from: Date, to: Date): boolean {
  const t = postedAt.getTime()
  return t >= from.getTime() && t <= to.getTime() + 86_400_000 - 1
}
