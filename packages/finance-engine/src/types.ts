export type CurrencyCode = 'PEN' | 'USD'

export type Confidence = 'high' | 'medium' | 'low' | 'insufficient'

export type EngineTransaction = {
  id: string
  postedAt: Date
  /** Signed: inflow +, outflow − */
  amount: number
  currency: CurrencyCode
  categorySlug: string
  merchantNormalized: string
  isTransfer: boolean
  isEssential?: boolean
  accountId?: string
}

export type RecurringItemInput = {
  merchantNormalized: string
  typicalAmount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'annual'
  nextExpected: Date
  lastSeen: Date
  isSubscription: boolean
  categorySlug?: string
}

export type AccountAnchor = {
  accountId: string
  kind: 'checking' | 'savings' | 'credit_card' | 'loan' | 'wallet' | 'cash'
  currency: CurrencyCode
  anchorBalance: number | null
  anchorDate: Date | null
}

export type GoalInput = {
  name: string
  targetAmount: number
  targetDate?: Date | null
  monthlyContribution?: number | null
  savedAmount: number
}

export type PeriodTotals = {
  income: number
  expenses: number
  byCategory: Record<string, number>
  count: number
}

export type MonthlyTotals = PeriodTotals & {
  year: number
  month: number
}

export type ScoreComponent = {
  key: 'savings_rate' | 'liquidity_buffer' | 'debt_load' | 'spending_stability' | 'commitments'
  label: string
  weight: number
  subScore: number
  inputs: Record<string, number>
  evidenceTxnIds: string[]
}

export type HealthScoreResult = {
  score: number
  label: 'Frágil' | 'En construcción' | 'Estable' | 'Sólida'
  components: ScoreComponent[]
  engineVersion: string
  periodFrom: string
  periodTo: string
}

export type CategorySpike = {
  type: 'category_spike'
  categorySlug: string
  current: number
  mean: number
  z: number
  impact: number
  evidenceTxnIds: string[]
}

export type UnusualTxn = {
  type: 'unusual_txn'
  transactionId: string
  amount: number
  modifiedZ: number
  categorySlug: string
  merchantNormalized: string
}

export type CategoryTrend = {
  type: 'category_trend'
  categorySlug: string
  monthlyTotals: number[]
}

export type AnomalyResult = {
  spikes: CategorySpike[]
  unusual: UnusualTxn[]
  trends: CategoryTrend[]
  engineVersion: string
}

export type DetectedRecurring = {
  merchantNormalized: string
  typicalAmount: number
  frequency: RecurringItemInput['frequency']
  nextExpected: Date
  lastSeen: Date
  confidence: number
  occurrences: number
  isSubscription: boolean
}

export type ForecastResult = {
  kind: 'balance' | 'net_flow'
  projectedEndOfPeriod: number
  projectedNextMonth?: number
  availableBeforeIncome: number | null
  incomeDate: number | null
  incomeDateRangeDays: number | null
  band?: { low: number; high: number }
  confidence: Confidence
  dailyDiscretionary: number
  recurringDue: Array<{ merchant: string; amount: number; date: string }>
  engineVersion: string
}

export type WhatIfPurchase = {
  cost: number
  downPayment: number
  installments: number
  monthlyInstallment: number
}

export type SimulationVerdict = 'fits' | 'tight' | 'compromises'

export type SimulationResult = {
  cashFlow: number[]
  projectedSavingsAfter: number
  minProjectedBalance: number
  goalDelayMonths: number
  verdict: SimulationVerdict
  engineVersion: string
}

export type FactsIntent =
  | 'spending_summary'
  | 'spending_breakdown'
  | 'category_spend'
  | 'income'
  | 'available'
  | 'recent'
  | 'balance'
  | 'help'
  | 'unknown_finance'
  | 'forecast'
  | 'score'
  | 'whatif'
  | 'subscriptions'
  | 'goal'
  | 'other'

export type FactsPayload = {
  intent: FactsIntent
  period: { from: string; to: string }
  currency: CurrencyCode
  figures: Record<string, number>
  comparisons?: Array<{ label: string; current: number; baseline: number }>
  items?: Array<{ label: string; amount: number }>
  txnCount: number
  confidence: Confidence
  evidenceTxnIds: string[]
  engineVersion: string
  /** Labels only (no numbers) that tell the LLM and the UI what the figures refer to. */
  context?: FactsContext
}

export type FactsContext = {
  periodLabel: string
  /** Set when the requested period was empty and the latest month with data was used. */
  requestedPeriodLabel?: string
  categoryLabel?: string
  hasHistory: boolean
  /** day | week | month | year — or 'all' for the historical balance. */
  granularity?: 'day' | 'week' | 'month' | 'year' | 'all'
}

export type ScoreWeights = {
  savingsRate: number
  liquidityBuffer: number
  debtLoad: number
  spendingStability: number
  commitments: number
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  savingsRate: 0.3,
  liquidityBuffer: 0.25,
  debtLoad: 0.2,
  spendingStability: 0.15,
  commitments: 0.1,
}

export const SUBSCRIPTION_SLUGS = new Set([
  'subscription',
  'suscripcion',
  'streaming',
  'software',
])
