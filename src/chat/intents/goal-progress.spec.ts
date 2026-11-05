import { parseGoalProgressQuestion } from '../../../packages/finance-engine/src'
import type { EngineTransaction } from '../../../packages/finance-engine/src'
import type { GoalRow } from '../../goals/goal-plans'
import { GoalProgressHandler } from './goal-progress.handler'
import type { ChatContext } from './handler'

const AS_OF = new Date('2026-11-04T00:00:00Z')
const goal = (over: Partial<GoalRow> = {}): GoalRow => ({
  id: 'g1',
  name: 'Viaje a Japón',
  target_amount: 3000,
  current_amount: 0,
  deadline: '2027-11-30',
  status: 'active',
  ...over,
})
const tx = (date: string, amount: number, goalId?: string): EngineTransaction => ({
  id: `${date}-${amount}`,
  postedAt: new Date(`${date}T00:00:00Z`),
  amount,
  currency: 'PEN',
  categorySlug: amount > 0 ? 'salary' : 'food',
  merchantNormalized: '',
  isTransfer: false,
  ...(goalId ? { goalId } : {}),
})
// Saves 200 a month over Aug–Oct, and set aside 600 for the trip.
const history = [
  ...['2026-08-05', '2026-09-05', '2026-10-05'].flatMap((d) => [tx(d, 1000), tx(d, -800)]),
  tx('2026-10-10', -600, 'g1'),
]

const ctx = (message: string): ChatContext => ({ userId: 'ana', message, asOf: AS_OF, question: {} as never, aiAllowed: true })
function handler(goals: GoalRow[], txs = history) {
  const listActive = jest.fn().mockResolvedValue(goals)
  const loadTransactions = jest.fn().mockResolvedValue(txs)
  return { h: new GoalProgressHandler({ listActive } as never, { loadTransactions } as never), listActive, loadTransactions }
}

describe('parseGoalProgressQuestion', () => {
  it.each([
    ['¿Cómo voy con Japón?', 'japón', false],
    ['como voy con mi meta laptop', 'laptop', true],
    ['¿Cuánto llevo para el viaje?', 'el viaje', false],
    ['¿cuánto me falta para mi meta de la bici?', 'la bici', true],
  ])('%s', (msg, goalText, mentionsGoal) => {
    expect(parseGoalProgressQuestion(msg)).toEqual({ all: false, goalText, mentionsGoal })
  })

  it.each(['¿Cómo van mis metas?', 'avance de mis metas', '¿cómo voy con mis metas?'])('all goals: %s', (msg) => {
    expect(parseGoalProgressQuestion(msg)).toEqual(expect.objectContaining({ all: true, mentionsGoal: true }))
  })

  it.each(['¿Cuánto me queda este mes?', 'gasté 20 en taxi', '¿Cómo alcanzo 6000 soles para enero 2028?', 'aparté 200 para japón'])(
    'not a progress question: %s',
    (msg) => expect(parseGoalProgressQuestion(msg)).toBeNull(),
  )
})

describe('GoalProgressHandler (INS-05)', () => {
  it('answers with engine figures: progress, what is left, and the monthly pace', async () => {
    const r = await handler([goal()]).h.handle(ctx('¿cómo voy con Japón?'))
    expect(r?.reply.reply).toBe(
      '"Viaje a Japón": llevas S/ 600.00 de S/ 3,000.00 (20%). Te faltan S/ 2,400.00. Para noviembre 2027 necesitas S/ 200.00 al mes y tu ahorro real es S/ 200.00: vas en ritmo 💪',
    )
    expect(r?.reply.followUps).toEqual(['Aparté 100 para Viaje a Japón', '¿Cómo junto S/ 2,400.00 para Viaje a Japón?'])
  })

  it('says how much is missing per month when the pace is short', async () => {
    const r = await handler([goal({ deadline: '2027-05-31' })]).h.handle(ctx('¿cómo voy con japon?'))
    expect(r?.reply.reply).toContain('necesitas S/ 400.00 al mes; tu ahorro real es S/ 200.00, así que te faltan S/ 200.00 al mes.')
  })

  it('a goal without a date asks for one; a reached goal celebrates', async () => {
    expect((await handler([goal({ deadline: null })]).h.handle(ctx('¿cómo voy con japón?')))?.reply.reply).toContain('No tiene fecha')
    expect((await handler([goal({ current_amount: 2400 })]).h.handle(ctx('¿cómo voy con japón?')))?.reply.reply).toContain('¡ya la lograste!')
  })

  it('lists every goal for "¿cómo van mis metas?"', async () => {
    const r = await handler([goal(), goal({ id: 'g2', name: 'Laptop', target_amount: 2000, deadline: null })]).h.handle(ctx('¿Cómo van mis metas?'))
    expect(r?.reply.reply.split('\n\n')).toHaveLength(2)
  })

  it('an unknown goal lists the real ones', async () => {
    const r = await handler([goal()]).h.handle(ctx('¿cómo voy con mi meta del carro?'))
    expect(r?.reply.reply).toBe('No encontré esa meta. Tus metas son: "Viaje a Japón".')
  })

  it('without goals: only a goal question is answered', async () => {
    expect((await handler([]).h.handle(ctx('¿cómo van mis metas?')))?.reply.reply).toContain('Todavía no tienes metas')
    expect(await handler([]).h.handle(ctx('¿cuánto llevo para fin de mes?'))).toBeNull()
  })

  it('a phrase that matches no goal and does not mention one is left to other handlers', async () => {
    expect(await handler([goal()]).h.handle(ctx('¿cuánto llevo para fin de mes?'))).toBeNull()
  })

  it('never computes progress outside the engine view', async () => {
    const t = handler([goal()])
    await t.h.handle(ctx('¿cómo voy con japón?'))
    expect(t.listActive).toHaveBeenCalledWith('ana')
    expect(t.loadTransactions).toHaveBeenCalledWith('ana')
  })
})
