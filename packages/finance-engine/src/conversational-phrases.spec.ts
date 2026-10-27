/**
 * Golden phrases from real beginner conversations (chat-conversational, Oct 2026).
 * Fixed asOf: Monday 26 Oct 2026 (Lima calendar day as midnight UTC).
 */
import { parseGoalRequest } from './goal-plan'
import { classifyIntent } from './intent'
import { resolvePeriodRange } from './periods'
import { resolveQuestion } from './question'

const OCT_26 = new Date(Date.UTC(2026, 9, 26))
const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('conversational phrases (asOf 2026-10-26)', () => {
  it('"dime quiero viajar a japon en enero 2028 crees que sea buena idea?" → goal_plan, future January 2028', () => {
    const q = resolveQuestion('dime quiero viajar a japon en enero 2028 crees que sea buena idea?', OCT_26)
    expect(q.intent).toBe('goal_plan')
    expect(q.period.future).toBe(true)
    expect(q.period.granularity).toBe('month')
    expect(q.period.label).toBe('enero 2028')
    expect(iso(q.period.from)).toBe('2028-01-01')
  })

  it('"quiero viajar a japon en enero 2028 con 7000 dolares, me alcanza?" → goal_plan (not whatif)', () => {
    const q = resolveQuestion('quiero viajar a japon en enero 2028 con 7000 dolares, me alcanza?', OCT_26)
    expect(q.intent).toBe('goal_plan')
    expect(q.period.future).toBe(true)
    expect(q.period.label).toBe('enero 2028')
  })

  it('"¿cuánto gasté en enero?" → spending for January 2026, not future', () => {
    const q = resolveQuestion('¿cuánto gasté en enero?', OCT_26)
    expect(q.intent).toBe('spending_summary')
    expect(q.period.future).toBeFalsy()
    expect(q.period.label).toBe('enero 2026')
    expect(iso(q.period.from)).toBe('2026-01-01')
    expect(iso(q.period.to)).toBe('2026-01-31')
  })

  it('"¿cuánta plata voy a tener el próximo mes?" → forecast for future November 2026', () => {
    const q = resolveQuestion('¿cuánta plata voy a tener el próximo mes?', OCT_26)
    expect(q.intent).toBe('forecast')
    expect(q.period.future).toBe(true)
    expect(q.period.label).toBe('noviembre 2026')
  })

  it('"gasté 2030 soles en la tele" is NOT a future period (a bare amount is not a year)', () => {
    const r = resolvePeriodRange('gasté 2030 soles en la tele', OCT_26)
    expect(r.future).toBeFalsy()
    expect(r.explicit).toBe(false)
    expect(r.label).toBe('octubre 2026')
    expect(resolveQuestion('gasté 2030 soles en la tele', OCT_26).intent).not.toBe('goal_plan')
  })

  it('"registra mi meta japon 2028 con un presupuesto de 7000 dolares" → "Japon", December 2028, year only, US$ 7000', () => {
    expect(parseGoalRequest('registra mi meta japon 2028 con un presupuesto de 7000 dolares', OCT_26)).toEqual({
      amount: 7000,
      currency: 'USD',
      name: 'Japon',
      deadline: { year: 2028, month: 11 },
      deadlinePast: false,
      deadlineYearOnly: true,
    })
  })

  it('"tengo plata en mi cuenta, ¿puedo gastarla?" → available', () => {
    expect(classifyIntent('tengo plata en mi cuenta, ¿puedo gastarla?')).toBe('available')
    expect(resolveQuestion('tengo plata en mi cuenta, ¿puedo gastarla?', OCT_26).intent).toBe('available')
  })

  it('"mes que viene" is also a projection', () => {
    const q = resolveQuestion('¿cuánto voy a tener el mes que viene?', OCT_26)
    expect(q.intent).toBe('forecast')
    expect(q.period.future).toBe(true)
  })

  it('"quiero ahorrar para el 2028" → year range with future', () => {
    const r = resolvePeriodRange('quiero ahorrar para el 2028', OCT_26)
    expect(r.future).toBe(true)
    expect(r.granularity).toBe('year')
    expect(r.label).toBe('el año 2028')
  })
})
