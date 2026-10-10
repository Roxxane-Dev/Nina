import type { EngineTransaction } from '../types'

/**
 * Golden dataset: synthetic user "Ana", salary S/ 4,500, three months.
 * Expected outputs are pinned in facts.spec.ts — changing them requires an
 * ENGINE_VERSION bump.
 */
let seq = 0
const tx = (date: string, amount: number, categorySlug: string): EngineTransaction => ({
  id: `ana-${++seq}`,
  postedAt: new Date(`${date}T00:00:00.000Z`),
  amount,
  currency: 'PEN',
  categorySlug,
  merchantNormalized: 'X',
  isTransfer: false,
})

export const ANA_TXS: EngineTransaction[] = [
  // July 2026
  tx('2026-07-01', 4500, 'salary'),
  tx('2026-07-03', -1200, 'home'),
  tx('2026-07-05', -350.5, 'food'),
  tx('2026-07-12', -120, 'transport'),
  tx('2026-07-20', -89.9, 'entertainment'),
  // August 2026
  tx('2026-08-01', 4500, 'salary'),
  tx('2026-08-03', -1200, 'home'),
  tx('2026-08-06', -410.3, 'food'),
  tx('2026-08-15', -260, 'transport'),
  tx('2026-08-22', 600, 'freelance'),
  // A transfer between own accounts must never count
  { ...tx('2026-08-25', -1000, 'other'), isTransfer: true },
]
