import { toEngineTransaction, toEngineTransactions } from './map-transactions'

const day = (d: Date | undefined) => d?.toISOString().slice(0, 10)

describe('toEngineTransaction', () => {
  const base = { id: 't1', type: 'expense', amount: 25, category: 'comida', description: 'menú' }

  it('accepts the real Supabase timestamptz format (regression: Invalid Date)', () => {
    const tx = toEngineTransaction({ ...base, date: '2026-10-10T00:00:00+00:00' })
    expect(day(tx?.postedAt)).toBe('2026-10-10')
  })

  it('accepts YYYY-MM-DD', () => {
    expect(day(toEngineTransaction({ ...base, date: '2026-07-05' })?.postedAt)).toBe('2026-07-05')
  })

  it('a real instant late at night in Lima keeps the Lima day', () => {
    expect(day(toEngineTransaction({ ...base, date: '2026-10-11T02:00:00+00:00' })?.postedAt)).toBe('2026-10-10')
  })

  it('signs amounts by type and normalizes categories', () => {
    const exp = toEngineTransaction({ ...base, date: '2026-10-10', amount: '25.50' })
    const inc = toEngineTransaction({ ...base, type: 'income', category: 'Sueldo', date: '2026-10-10', amount: 4500 })
    expect(exp?.amount).toBe(-25.5)
    expect(exp?.categorySlug).toBe('food')
    expect(inc?.amount).toBe(4500)
    expect(inc?.categorySlug).toBe('salary')
  })

  it.each([
    [{ date: 'garbage' }],
    [{ date: null }],
    [{ date: undefined }],
    [{ date: '2026-10-10', amount: 'abc' }],
  ])('rejects invalid rows %p', (patch) => {
    expect(toEngineTransaction({ ...base, ...patch } as never)).toBeNull()
  })

  it('toEngineTransactions reports how many rows were dropped', () => {
    const r = toEngineTransactions([
      { ...base, date: '2026-10-10T00:00:00+00:00' },
      { ...base, id: 't2', date: 'nope' },
    ])
    expect(r.txs).toHaveLength(1)
    expect(r.dropped).toBe(1)
  })
})
