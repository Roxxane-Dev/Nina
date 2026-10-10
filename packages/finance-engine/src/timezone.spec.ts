import { APP_TIME_ZONE, isValidDate, localDayOf, localToday, toLocalDay } from './timezone'

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null

describe('timezone (America/Lima)', () => {
  it('is the single configured zone', () => {
    expect(APP_TIME_ZONE).toBe('America/Lima')
  })

  it.each([
    ['2026-10-10', '2026-10-10'],
    ['2026-10-10T00:00:00+00:00', '2026-10-10'], // calendar day stored in timestamptz (how Supabase returns our rows)
    ['2026-10-10T00:00:00.000Z', '2026-10-10'],
    ['2026-10-10T00:00:01+00:00', '2026-10-09'], // a real instant: 7 p.m. Oct 9 in Lima
    ['2026-10-10T05:00:00+00:00', '2026-10-10'], // midnight in Lima
    ['2026-10-10T21:00:00-05:00', '2026-10-10'], // 9 p.m. in Lima stays the same day
    ['2026-10-11T00:30:00Z', '2026-10-10'], // 00:30 UTC is still the previous day in Lima
    ['2027-01-01T03:00:00Z', '2026-12-31'], // year boundary
  ])('%s → %s', (input, expected) => {
    expect(day(toLocalDay(input))).toBe(expected)
  })

  it.each(['', 'nope', '2026-02-31', '2026-13-01', '2026-10-10T00:00:00+00:00T00:00:00.000Z'])(
    'invalid %p → null',
    (input) => {
      expect(toLocalDay(input)).toBeNull()
    },
  )

  it('handles Date, null and invalid Date', () => {
    expect(day(toLocalDay(new Date('2026-10-10T15:00:00Z')))).toBe('2026-10-10')
    expect(toLocalDay(null)).toBeNull()
    expect(localDayOf(new Date('x'))).toBeNull()
  })

  it('localToday uses Lima, not the machine zone', () => {
    expect(day(localToday(new Date('2026-10-11T02:00:00Z')))).toBe('2026-10-10')
    expect(() => localToday(new Date('x'))).toThrow(RangeError)
  })

  it('isValidDate', () => {
    expect(isValidDate(new Date())).toBe(true)
    expect(isValidDate(new Date('x'))).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })
})
