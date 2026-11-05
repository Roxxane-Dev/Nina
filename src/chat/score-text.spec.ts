import { computeHealthScore, type EngineTransaction } from '../../packages/finance-engine/src'
import { scoreText } from './score-text'

const tx = (m: number, d: number, amount: number, slug: string): EngineTransaction => ({
  id: `${m}-${d}-${amount}`,
  postedAt: new Date(Date.UTC(2026, m, d)),
  amount,
  currency: 'PEN',
  categorySlug: slug,
  merchantNormalized: slug,
  isTransfer: false,
})
const asOf = new Date(Date.UTC(2026, 8, 20))
const months = (ms: number[]) => ms.flatMap((m) => [tx(m, 1, 4000, 'salary'), tx(m, 5, -2400, 'food')])

describe('scoreText (INS-02)', () => {
  it('gives the score, each measured part in words, and what was not measured', () => {
    const t = scoreText(computeHealthScore(months([5, 6, 7]), asOf))
    expect(t.startsWith('Tu salud financiera: 100/100, sólida.')).toBe(true)
    expect(t).toContain('• Tasa de ahorro: Te queda el 40% de lo que entra')
    expect(t).toContain('No medí colchón: me faltan datos, así que no te resta.')
  })

  it('too little history says so instead of inventing a score', () => {
    expect(scoreText(computeHealthScore(months([7]), asOf))).toBe(
      'Para darte un puntaje honesto necesito al menos 2 meses con ingresos registrados, y llevo 1. Sigue registrando y lo armamos.',
    )
  })
})
