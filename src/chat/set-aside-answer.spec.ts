import { buildFactsPayload, monthRange, type EngineTransaction } from '../../packages/finance-engine/src'
import { CHAT_SYSTEM_PROMPT_V1 } from '../nina-router/chat-prompt'
import { setAsideCausesNegative, templatedAnswer } from '../nina-router/validator'
import { QueryResponder } from './intents/query-responder'
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

describe('HOME-02: the LLM is told set-aside money is not a problem', () => {
  it('the prompt treats set_aside as saving and forbids scolding', () => {
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('FACTS.figures.set_aside')
    expect(CHAT_SYSTEM_PROMPT_V1).toContain('no lo regañes')
  })
})

describe('HOME-02: negative only because of money set aside', () => {
  const noIncome = [tx('2026-10-10', -250, 'other', 'g1')]
  const withIncome = [tx('2026-10-01', 1000, 'salary'), tx('2026-10-02', -900, 'home'), tx('2026-10-10', -250, 'other', 'g1')]
  const overspent = [tx('2026-10-01', 1000, 'salary'), tx('2026-10-02', -1200, 'home'), tx('2026-10-10', -100, 'other', 'g1')]

  it('without income it says so, and never that money was overspent', () => {
    const { message } = templatedAnswer(facts(noIncome))
    expect(message).toContain('apartaste S/ 250.00 para tus metas, y eso es ahorro')
    expect(message).toContain('Todavía no registras ingresos')
    expect(message).toContain('-S/ 250.00')
    expect(message).not.toMatch(/gastaste|recort/i)
  })

  it('with income it explains that more was set aside than was left', () => {
    expect(templatedAnswer(facts(withIncome)).message).toContain('Apartaste más de lo que te quedaba')
  })

  it('does not call the LLM, even with AI consent', async () => {
    const explainFacts = jest.fn()
    const responder = new QueryResponder({ explainFacts } as never)
    const out = await responder.explain({ userId: 'u1', message: '¿cuánto me queda?', aiAllowed: true } as never, facts(noIncome))
    expect(explainFacts).not.toHaveBeenCalled()
    expect(out.llmUsed).toBe(false)
  })

  it('real overspending still goes the normal way', () => {
    expect(setAsideCausesNegative(facts(overspent))).toBe(false)
  })

  it('a positive month with money set aside still uses the LLM path', () => {
    const positive = [tx('2026-10-01', 4000, 'salary'), tx('2026-10-10', -200, 'other', 'g1')]
    expect(setAsideCausesNegative(facts(positive))).toBe(false)
  })
})
