import { ENGINE_VERSION } from './version'
import type { ForecastResult, GoalInput, SimulationResult, WhatIfPurchase } from './types'

export function simulatePurchase(
  forecast: ForecastResult,
  purchase: WhatIfPurchase,
  opts?: { goals?: GoalInput[]; bufferTarget?: number },
): SimulationResult {
  const n = Math.max(0, purchase.installments)
  const cashFlow = Array.from({ length: Math.max(1, n + 1) }, () => 0)
  cashFlow[0] = -purchase.downPayment
  for (let i = 1; i <= n; i++) cashFlow[i] = -purchase.monthlyInstallment

  const committed = purchase.downPayment + n * purchase.monthlyInstallment
  const projectedSavingsAfter = forecast.projectedEndOfPeriod - committed
  const running: number[] = []
  let bal = forecast.kind === 'balance' ? forecast.projectedEndOfPeriod : 0
  for (const cf of cashFlow) {
    bal += cf
    running.push(bal)
  }
  const minProjectedBalance = Math.min(...running)
  const buffer = opts?.bufferTarget ?? 0
  let verdict: SimulationResult['verdict'] = 'fits'
  if (minProjectedBalance < 0) verdict = 'compromises'
  else if (minProjectedBalance < buffer) verdict = 'tight'

  const monthly = opts?.goals?.[0]?.monthlyContribution ?? 0
  const goalDelayMonths = monthly > 0 ? Math.ceil(committed / monthly) : 0

  return {
    cashFlow,
    projectedSavingsAfter,
    minProjectedBalance,
    goalDelayMonths,
    verdict,
    engineVersion: ENGINE_VERSION,
  }
}

export function simulateSaveMore(forecast: ForecastResult, monthlyAmount: number): ForecastResult {
  return {
    ...forecast,
    projectedEndOfPeriod: forecast.projectedEndOfPeriod + monthlyAmount,
  }
}

export function simulateIncomeChange(forecast: ForecastResult, deltaMonthly: number): ForecastResult {
  return {
    ...forecast,
    projectedEndOfPeriod: forecast.projectedEndOfPeriod + deltaMonthly,
  }
}
