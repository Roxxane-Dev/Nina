import { buildFactsPayload, localToday, resolveQuestion } from '../../packages/finance-engine/src'
import { toEngineTransactions, type TransactionRow } from './map-transactions'

/** Rows shaped exactly like PostgREST returns transactions.date (timestamptz). */
const rows: TransactionRow[] = [
  { id: 'a', type: 'income', amount: 4500, category: 'salary', description: 'sueldo', date: '2026-09-01T00:00:00+00:00' },
  { id: 'b', type: 'expense', amount: '120.50', category: 'food', description: 'super', date: '2026-09-15T00:00:00+00:00' },
  { id: 'c', type: 'expense', amount: 80, category: 'transport', description: 'taxi', date: '2026-09-30T00:00:00+00:00' },
  { id: 'd', type: 'expense', amount: 60, category: 'food', description: 'menu', date: '2026-10-02T00:00:00+00:00' },
  { id: 'e', type: 'expense', amount: 15, category: 'food', description: 'cafe', date: '2026-10-09T14:30:00+00:00' },
]
const OCT_9 = localToday(new Date('2026-10-09T17:00:00Z'))

function ask(question: string) {
  const { txs } = toEngineTransactions(rows)
  const q = resolveQuestion(question, OCT_9)
  return buildFactsPayload({ intent: q.intent, txs, asOf: OCT_9, period: q.period, category: q.category })
}

describe('analytics over timestamptz rows (end to end through the bridge)', () => {
  it('keeps every row: none dropped', () => {
    expect(toEngineTransactions(rows).dropped).toBe(0)
  })

  it('"cuánto gasté el último mes" is September, from the stored rows', () => {
    const facts = ask('cuánto gasté el último mes')
    expect(facts.figures.expenses).toBe(200.5)
    expect(facts.figures.income).toBe(4500)
    expect(facts.context?.hasHistory).toBe(true)
    expect(facts.txnCount).toBe(3)
  })

  it('"cuánto gasté este mes" is October', () => {
    const facts = ask('cuánto gasté este mes')
    expect(facts.figures.expenses).toBe(75)
  })

  it('a day-boundary row (midnight UTC) stays on its calendar day', () => {
    expect(ask('cuánto gasté el último mes').figures.expenses).toBe(200.5) // includes 30 Sep
    expect(ask('cuánto gasté este mes').figures.expenses).toBe(75) // 1 Oct row excluded from Sep
  })
})
