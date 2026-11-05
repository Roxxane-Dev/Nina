import { computeHealthScore } from './score'
import type { EngineTransaction } from './types'

function tx(y: number, m: number, d: number, amount: number, slug: string): EngineTransaction {
  return {
    id: `${y}-${m}-${d}-${amount}`,
    postedAt: new Date(Date.UTC(y, m, d)),
    amount,
    currency: 'PEN',
    categorySlug: slug,
    merchantNormalized: slug,
    isTransfer: false,
  }
}

describe('computeHealthScore', () => {
  it('returns 0–100 with five components and a label', () => {
    const asOf = new Date(Date.UTC(2026, 8, 20))
    const txs: EngineTransaction[] = []
    for (const month of [5, 6, 7]) {
      txs.push(tx(2026, month, 1, 4000, 'salary'))
      txs.push(tx(2026, month, 5, -800, 'food'))
      txs.push(tx(2026, month, 8, -400, 'transport'))
    }
    const result = computeHealthScore(txs, asOf, {
      anchors: [{
        accountId: 'a1',
        kind: 'checking',
        currency: 'PEN',
        anchorBalance: 6000,
        anchorDate: asOf,
      }],
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.components).toHaveLength(5)
    expect(result.label).toMatch(/Frágil|En construcción|Estable|Sólida/)
  })
})

describe('computeHealthScore: explainable and fair (INS-02)', () => {
  const asOf = new Date(Date.UTC(2026, 8, 20))
  const salaryMonths = (months: number[], spend = 2400, extra: Array<[number, number, string]> = []) => {
    const out: EngineTransaction[] = []
    for (const m of months) {
      out.push(tx(2026, m, 1, 4000, 'salary'), tx(2026, m, 5, -spend, 'food'))
      for (const [d, a, slug] of extra) out.push(tx(2026, m, d, a, slug))
    }
    return out
  }

  it('without account balances the cushion is not measured and does not drag the score down', () => {
    const r = computeHealthScore(salaryMonths([5, 6, 7]), asOf)
    const cushion = r.components.find((c) => c.key === 'liquidity_buffer')!
    expect(cushion.measured).toBe(false)
    expect(cushion.weight).toBe(0)
    expect(cushion.explanation).toContain('No cuenta en tu puntaje')
    expect(r.components.filter((c) => c.measured).reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 10)
    // Saves 40%, steady spending, no debt, no fixed payments: a solid score, not "Frágil".
    expect(r.sufficient).toBe(true)
    expect(r.score).toBe(100)
    expect(r.label).toBe('Sólida')
  })

  it('says what it measured, in words and engine figures', () => {
    const r = computeHealthScore(salaryMonths([5, 6, 7]), asOf)
    expect(r.components.find((c) => c.key === 'savings_rate')!.explanation).toBe(
      'Te queda el 40% de lo que entra (S/ 1,600.00 de S/ 4,000.00 al mes). Lo sano es 20% o más.',
    )
    expect(r.components.find((c) => c.key === 'debt_load')!.explanation).toBe('No veo pagos de deudas en tus últimos meses.')
  })

  it('debt is measured within the same months, not over the whole history', () => {
    const old = [tx(2025, 0, 10, -9000, 'debt')]
    const r = computeHealthScore([...old, ...salaryMonths([5, 6, 7], 2400, [[12, -400, 'debt']])], asOf)
    const debt = r.components.find((c) => c.key === 'debt_load')!
    expect(debt.inputs.debtPay).toBe(400)
    expect(debt.explanation).toContain('Pagas S/ 400.00 al mes en deudas, el 10% de lo que entra')
  })

  it('empty months do not count as months with zero income', () => {
    const r = computeHealthScore(salaryMonths([6, 7]), asOf)
    expect(r.monthsUsed).toBe(2)
    expect(r.components.find((c) => c.key === 'savings_rate')!.inputs.income).toBe(4000)
  })

  it('stability needs three months to compare', () => {
    const r = computeHealthScore(salaryMonths([6, 7]), asOf)
    expect(r.components.find((c) => c.key === 'spending_stability')!.measured).toBe(false)
  })

  it('too little history: no score, said as such', () => {
    const r = computeHealthScore(salaryMonths([7]), asOf)
    expect(r.sufficient).toBe(false)
    expect(r.score).toBe(0)
    expect(r.label).toBe('Sin datos suficientes')
  })

  it('spending more than what comes in is said plainly', () => {
    const r = computeHealthScore(salaryMonths([5, 6, 7], 5000), asOf)
    expect(r.components.find((c) => c.key === 'savings_rate')!.explanation).toBe('Gastas más de lo que entra: S/ 1,000.00 al mes por encima de tus ingresos.')
  })
})
