import { monthRange, previousRange, resolvePeriodRange } from './periods'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const span = (r: { from: Date; to: Date }) => `${iso(r.from)}..${iso(r.to)}`
const OCT_9 = new Date(Date.UTC(2026, 9, 9)) // Friday

describe('resolvePeriodRange', () => {
  it.each([
    ['dime cuanto he gastado en el año', '2026-01-01..2026-10-09', 'year', 'el año 2026'],
    ['¿cuánto gasté este año?', '2026-01-01..2026-10-09', 'year', 'el año 2026'],
    ['en lo que va del año', '2026-01-01..2026-10-09', 'year', 'el año 2026'],
    ['gastos del año pasado', '2025-01-01..2025-12-31', 'year', 'el año 2025'],
    ['dime cuanto he gastado el ultimo mes', '2026-09-01..2026-09-30', 'month', 'setiembre 2026'],
    ['¿y el mes pasado?', '2026-09-01..2026-09-30', 'month', 'setiembre 2026'],
    ['el mes anterior', '2026-09-01..2026-09-30', 'month', 'setiembre 2026'],
    ['¿cuánto gasté este mes?', '2026-10-01..2026-10-09', 'month', 'octubre 2026'],
    ['¿cuánto gasté hoy?', '2026-10-09..2026-10-09', 'day', 'hoy'],
    ['¿y ayer?', '2026-10-08..2026-10-08', 'day', 'ayer'],
    ['esta semana', '2026-10-05..2026-10-09', 'week', 'esta semana'],
    ['la semana pasada', '2026-09-28..2026-10-04', 'week', 'la semana pasada'],
    ['gastos de julio', '2026-07-01..2026-07-31', 'month', 'julio 2026'],
    ['en septiembre', '2026-09-01..2026-09-30', 'month', 'setiembre 2026'],
    ['en diciembre', '2025-12-01..2025-12-31', 'month', 'diciembre 2025'],
  ])('%s → %s (%s)', (text, expectedSpan, granularity, label) => {
    const r = resolvePeriodRange(text, OCT_9)
    expect(span(r)).toBe(expectedSpan)
    expect(r.granularity).toBe(granularity)
    expect(r.label).toBe(label)
    expect(r.explicit).toBe(true)
  })

  it('defaults to the current month, not explicit', () => {
    const r = resolvePeriodRange('¿cuánto gasté?', OCT_9)
    expect(span(r)).toBe('2026-10-01..2026-10-09')
    expect(r.explicit).toBe(false)
  })

  it('handles year and week boundaries', () => {
    const jan2 = new Date(Date.UTC(2027, 0, 2)) // Saturday
    expect(span(resolvePeriodRange('el mes pasado', jan2))).toBe('2026-12-01..2026-12-31')
    expect(span(resolvePeriodRange('esta semana', jan2))).toBe('2026-12-28..2027-01-02')
    expect(span(resolvePeriodRange('este año', jan2))).toBe('2027-01-01..2027-01-02')
  })
})

describe('previousRange', () => {
  it('compares the same span', () => {
    expect(span(previousRange(monthRange(2026, 9, OCT_9, false)))).toBe('2026-09-01..2026-09-09')
    expect(span(previousRange(monthRange(2026, 7, OCT_9)))).toBe('2026-07-01..2026-07-31')
    expect(span(previousRange(resolvePeriodRange('en el año', OCT_9)))).toBe('2025-01-01..2025-10-09')
    expect(span(previousRange(resolvePeriodRange('esta semana', OCT_9)))).toBe('2026-09-28..2026-10-02')
    expect(span(previousRange(resolvePeriodRange('hoy', OCT_9)))).toBe('2026-10-08..2026-10-08')
  })

  it('clips to the shorter previous month', () => {
    const mar31 = new Date(Date.UTC(2026, 2, 31))
    expect(span(previousRange(monthRange(2026, 2, mar31, false)))).toBe('2026-02-01..2026-02-28')
  })
})
