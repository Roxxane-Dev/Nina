import { buildNudges, type NudgeGoal } from './nudges'
import type { EngineTransaction } from './types'

let seq = 0
const tx = (date: string, amount: number, categorySlug: string, extra: Partial<EngineTransaction> = {}): EngineTransaction => ({
  id: `t${++seq}`,
  postedAt: new Date(`${date}T00:00:00Z`),
  amount,
  currency: 'PEN',
  categorySlug,
  merchantNormalized: '',
  isTransfer: false,
  ...extra,
})
const day = (d: string) => new Date(`${d}T00:00:00Z`)
const kinds = (txs: EngineTransaction[], asOf: string, goals: NudgeGoal[] = []) => buildNudges({ txs, asOf: day(asOf), goals }).map((n) => n.kind)
const find = (txs: EngineTransaction[], asOf: string, kind: string, goals: NudgeGoal[] = []) =>
  buildNudges({ txs, asOf: day(asOf), goals }).find((n) => n.kind === kind)

const salary = (d: string) => tx(d, 4000, 'salary')

describe('buildNudges', () => {
  it('a brand new user gets nothing', () => {
    expect(buildNudges({ txs: [], asOf: day('2026-12-05'), goals: [] })).toEqual([])
  })

  it('weekend: Friday to Sunday only, with the engine figure, one key for the three days', () => {
    const txs = [salary('2026-11-02'), tx('2026-11-03', -1000, 'home')]
    const fri = find(txs, '2026-11-06', 'weekend')
    expect(fri?.title).toBe('Es fin de semana y el cuerpo lo sabe')
    expect(fri?.body).toContain('S/ 3,000.00')
    expect(find(txs, '2026-11-08', 'weekend')?.key).toBe(fri?.key)
    expect(find(txs, '2026-11-13', 'weekend')?.key).not.toBe(fri?.key)
    expect(find(txs, '2026-11-11', 'weekend')).toBeUndefined()
  })

  it('subscriptions shows what the month carries', () => {
    const n = find([salary('2026-11-02'), tx('2026-11-03', -89.9, 'subscriptions')], '2026-11-04', 'subscriptions')
    expect(n?.body).toContain('S/ 89.90')
    expect(n?.body).toContain('¿Seguro que las estás usando todas?')
  })

  it('christmas: December 1 to 24 with the days left, and an offer to budget', () => {
    const txs = [salary('2026-12-01')]
    expect(find(txs, '2026-12-11', 'christmas')?.title).toBe('Faltan 14 días para Navidad')
    expect(find(txs, '2026-12-11', 'christmas')?.body).toContain('presupuestemos')
    expect(find(txs, '2026-12-11', 'christmas')?.action).toEqual({ type: 'chat', draft: 'Quiero juntar para los regalos de Navidad ' })
    expect(find(txs, '2026-11-30', 'christmas')).toBeUndefined()
    expect(find(txs, '2026-12-25', 'christmas')).toBeUndefined()
  })

  it('no income: from day 5, only for someone who registered income before', () => {
    const txs = [salary('2026-10-02'), tx('2026-11-01', -50, 'food')]
    expect(find(txs, '2026-11-04', 'no_income')).toBeUndefined()
    expect(find(txs, '2026-11-05', 'no_income')?.action).toEqual({ type: 'add' })
    expect(find([tx('2026-11-01', -50, 'food')], '2026-11-05', 'no_income')).toBeUndefined()
  })

  it('real overspending is calm, without jokes, and turns the playful ones off', () => {
    const txs = [tx('2026-12-01', 1000, 'salary'), tx('2026-12-02', -1500, 'home'), tx('2026-12-03', -20, 'subscriptions')]
    const all = buildNudges({ txs, asOf: day('2026-12-04'), goals: [{ id: 'g', name: 'Viaje', remaining: 100, contributedThisMonth: false }] })
    expect(all.map((n) => n.kind)).toEqual(['overspent'])
    expect(all[0].tone).toBe('calm')
    expect(all[0].body).toContain('-S/ 520.00')
    expect(all[0].body).not.toMatch(/👀|bestie|audaz/i)
  })

  it('money set aside is not overspending (D-016)', () => {
    const txs = [salary('2026-10-02'), tx('2026-11-01', -250, 'savings', { goalId: 'g' })]
    expect(kinds(txs, '2026-11-03')).not.toContain('overspent')
  })

  it('goals: reached celebrates; idle waits until day 10 and stops once there is a contribution', () => {
    const txs = [salary('2026-11-02')]
    const idle: NudgeGoal = { id: 'g1', name: 'Japón', remaining: 500, contributedThisMonth: false }
    expect(kinds(txs, '2026-11-09', [idle])).not.toContain('goal_idle')
    expect(find(txs, '2026-11-10', 'goal_idle', [idle])?.title).toBe('¿Y "Japón"?')
    expect(kinds(txs, '2026-11-10', [{ ...idle, contributedThisMonth: true }])).not.toContain('goal_idle')
    expect(find(txs, '2026-11-10', 'goal_reached', [{ ...idle, remaining: 0 }])?.tone).toBe('positive')
  })

  it('upcoming payment from a detected monthly recurrence, within three days', () => {
    const rent = (d: string) => tx(d, -1200, 'home', { merchantNormalized: 'ALQUILER' })
    const txs = [salary('2026-11-01'), rent('2026-08-05'), rent('2026-09-05'), rent('2026-10-05')]
    const n = find(txs, '2026-11-03', 'upcoming_payment')
    expect(n?.title).toBe('Se viene Alquiler')
    expect(n?.body).toContain('S/ 1,200.00')
    expect(find(txs, '2026-10-20', 'upcoming_payment')).toBeUndefined()
  })

  it('a category well above normal says by how much', () => {
    const txs = [
      salary('2026-11-01'),
      ...['2026-05-02', '2026-06-02', '2026-07-02', '2026-08-02', '2026-09-02', '2026-10-02'].map((d) => tx(d, -100, 'food')),
      tx('2026-11-02', -400, 'food'),
    ]
    const n = find(txs, '2026-11-03', 'category_spike')
    expect(n?.title).toBe('Comida anda movida este mes')
    expect(n?.body).toContain('S/ 400.00')
    expect(n?.body).toContain('S/ 300.00')
  })

  it('every key is per period, so dismissing one does not silence the next month', () => {
    const txs = [salary('2026-11-02'), tx('2026-11-03', -20, 'subscriptions'), salary('2026-12-02'), tx('2026-12-03', -20, 'subscriptions')]
    expect(find(txs, '2026-11-05', 'subscriptions')?.key).not.toBe(find(txs, '2026-12-05', 'subscriptions')?.key)
  })
})
