import {
  normalizeCategorySlug,
  toLocalDay,
  type EngineTransaction,
} from '../../packages/finance-engine/src'
import type { FinanceTransaction } from '../intelligence/nina-finance.types'

export type TransactionRow = {
  id: string
  type?: string
  amount: number | string
  category?: string | null
  description?: string | null
  /** 'YYYY-MM-DD' or, as the real timestamptz column returns it, '2026-10-10T00:00:00+00:00'. */
  date?: string | null
  posted_at?: string | null
  is_transfer?: boolean
  account_id?: string
}

/**
 * Maps a stored transaction to the engine shape, or null when the row cannot be
 * trusted (unparseable date or non-finite amount). Dates go through the single
 * Lima convention in finance-engine/timezone.ts.
 */
export function toEngineTransaction(row: TransactionRow): EngineTransaction | null {
  const amount = Number(row.amount)
  const postedAt = toLocalDay(row.posted_at ?? row.date ?? null)
  if (!postedAt || !Number.isFinite(amount)) return null

  const type = row.type ?? 'expense'
  const isTransfer = row.is_transfer === true || type === 'transfer'
  const signed = isTransfer ? amount : type === 'income' ? Math.abs(amount) : -Math.abs(amount)
  return {
    id: String(row.id),
    postedAt,
    amount: signed,
    currency: 'PEN',
    categorySlug: normalizeCategorySlug(row.category),
    merchantNormalized: (row.description ?? '').trim().toUpperCase(),
    isTransfer,
    accountId: row.account_id,
  }
}

/** Maps many rows, dropping the invalid ones; `dropped` lets callers log the count. */
export function toEngineTransactions(rows: TransactionRow[]): {
  txs: EngineTransaction[]
  dropped: number
} {
  const txs: EngineTransaction[] = []
  for (const row of rows) {
    const tx = toEngineTransaction(row)
    if (tx) txs.push(tx)
  }
  return { txs, dropped: rows.length - txs.length }
}

export function fromFinanceTransactions(rows: FinanceTransaction[]): EngineTransaction[] {
  return toEngineTransactions(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      date: r.date,
    })),
  ).txs
}
