import { normalizeCategorySlug, type EngineTransaction } from '../../packages/finance-engine/src'
import type { FinanceTransaction } from '../intelligence/nina-finance.types'

export function toEngineTransaction(row: {
  id: string
  type?: string
  amount: number | string
  category?: string | null
  description?: string | null
  date?: string
  posted_at?: string
  is_transfer?: boolean
  account_id?: string
}): EngineTransaction {
  const amount = Number(row.amount)
  const type = row.type ?? 'expense'
  const isTransfer = row.is_transfer === true || type === 'transfer'
  const signed = isTransfer ? amount : type === 'income' ? Math.abs(amount) : -Math.abs(amount)
  const posted = row.posted_at ?? row.date ?? new Date().toISOString().slice(0, 10)
  return {
    id: String(row.id),
    postedAt: new Date(`${posted}T00:00:00.000Z`),
    amount: signed,
    currency: 'PEN',
    categorySlug: normalizeCategorySlug(row.category),
    merchantNormalized: (row.description ?? '').trim().toUpperCase(),
    isTransfer,
    accountId: row.account_id,
  }
}

export function fromFinanceTransactions(rows: FinanceTransaction[]): EngineTransaction[] {
  return rows.map((r) =>
    toEngineTransaction({
      id: r.id,
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      date: r.date,
    }),
  )
}
