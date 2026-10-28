import { buildFactsPayload, monthRange, type EngineTransaction } from '../../packages/finance-engine/src'
import { templatedAnswer } from '../nina-router/validator'
import { buildCard } from './answer-card'

const tx = (date: string, amount: number, categorySlug: string, goalId?: string): EngineTransaction => ({
  id: `${date}-${amount}`,
  postedAt: new Date(`${date}T00:00:00Z`),
  amount,
  currency: 'PEN',
  categorySlug,
  merchantNormalized: '',
  isTransfer: false,
  ...(goalId ? { goalId } : {}),
})

const asOf = new Date('2026-10-27T00:00:00Z')
const facts = (txs: EngineTransaction[]) =>
  buildFactsPayload({ intent: 'available', txs, asOf, period: monthRange(2026, 9, asOf, true) })

describe('HOME-02: "¿cuánto me queda?" with money set aside', () => {
  const withGoal = [tx('2026-10-01', 4000, 'salary'), tx('2026-10-05', -1000, 'home'), tx('2026-10-10', -200, 'other', 'g1')]

  it('the template names what was set aside and the engine available', () => {
    const f = facts(withGoal)
    expect(f.figures.set_aside).toBe(200)
    expect(f.figures.available).toBe(2800)
    expect(templatedAnswer(f).message).toContain('gastaste S/ 1,000.00 y apartaste S/ 200.00 para tus metas: te quedan S/ 2,800.00')
  })

  it('the card shows the set-aside row without an alert tone', () => {
    const card = buildCard(facts(withGoal))
    expect(card?.highlight?.label).toBe('Disponible (ingresos − gastos − apartado)')
    expect(card?.rows).toContainEqual({ label: 'Apartado para metas', amount: -200 })
  })

  it('without contributions nothing changes', () => {
    const f = facts(withGoal.slice(0, 2))
    expect(f.figures.set_aside).toBeUndefined()
    expect(templatedAnswer(f).message).toContain('gastaste S/ 1,000.00: te quedan S/ 3,000.00')
    expect(buildCard(f)?.rows).toHaveLength(2)
  })
})
