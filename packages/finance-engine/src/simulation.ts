/**
 * INS-06: "¿Qué pasa si compro…?" on top of the month-end outlook (buildMonthOutlook), never a
 * second projection. Card interest is unknown, so installments are cost / N and the answer says so.
 */
import { trailingFullMonths } from './aggregates'
import type { MonthOutlook } from './outlook'
import type { EngineTransaction } from './types'

export type PurchaseVerdict = 'fits' | 'tight' | 'compromises'

export type PurchaseSimulation = {
  cost: number
  /** 0 = cash. */
  installments: number
  /** What leaves this month: the full cost, or one installment. */
  thisMonth: number
  monthlyPayment: number
  projectedBefore: number
  projectedAfter: number
  /** Less than a week of typical spending left at month end. */
  verdict: PurchaseVerdict
  /** Months of the user's real savings pace the purchase is worth. Null without a positive pace. */
  monthsOfSavings: number | null
}

/** A week of typical spending is the margin under which a purchase is "tight". */
export const TIGHT_MARGIN_DAYS = 7
const round = (n: number) => Math.round(n * 100) / 100

/**
 * The user's real monthly savings: average income − expenses over the last full months with data.
 * The one place this is computed; goal plans use it too.
 */
export function savingsPace(
  txs: EngineTransaction[],
  asOf: Date,
): { pace: number; months: number; income: number; expenses: number; count: number } | null {
  const months = trailingFullMonths(txs, asOf, 3).filter((m) => m.count > 0)
  if (!months.length) return null
  const income = months.reduce((s, m) => s + m.income, 0) / months.length
  const expenses = months.reduce((s, m) => s + m.expenses, 0) / months.length
  return { pace: income - expenses, months: months.length, income, expenses, count: months.reduce((s, m) => s + m.count, 0) }
}

export function simulatePurchase(
  outlook: MonthOutlook,
  purchase: { cost: number; installments?: number },
  pace: number | null,
): PurchaseSimulation {
  const installments = Math.max(0, Math.floor(purchase.installments ?? 0))
  const monthlyPayment = installments > 0 ? round(purchase.cost / installments) : round(purchase.cost)
  const thisMonth = installments > 0 ? monthlyPayment : round(purchase.cost)
  const projectedAfter = round(outlook.projected - thisMonth)
  const margin = outlook.dailySpend * TIGHT_MARGIN_DAYS
  const verdict: PurchaseVerdict = projectedAfter < 0 ? 'compromises' : projectedAfter < margin ? 'tight' : 'fits'
  return {
    cost: round(purchase.cost),
    installments,
    thisMonth,
    monthlyPayment,
    projectedBefore: outlook.projected,
    projectedAfter,
    verdict,
    monthsOfSavings: pace !== null && pace > 0 ? Math.round((purchase.cost / pace) * 10) / 10 : null,
  }
}
