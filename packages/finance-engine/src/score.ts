import { trailingFullMonths } from './aggregates'
import { solesText } from './money'
import { clamp, mean, stdev } from './stats'
import { isoDate, startOfMonth } from './period'
import { ENGINE_VERSION } from './version'
import {
  DEFAULT_SCORE_WEIGHTS,
  type AccountAnchor,
  type EngineTransaction,
  type HealthScoreResult,
  type RecurringItemInput,
  type ScoreComponent,
  type ScoreWeights,
} from './types'

const DISCRETIONARY = new Set([
  'food',
  'comida',
  'transport',
  'transporte',
  'entertainment',
  'entretenimiento',
  'shopping',
  'cafe',
  'café',
  'snacks',
  'delivery',
])
const DEBT = new Set(['debt', 'loan', 'deuda'])

/** Fewer months than this with movements and the score would be a guess. */
export const MIN_SCORE_MONTHS = 2
/** Stability compares months, so it needs at least this many. */
const MIN_STABILITY_MONTHS = 3

function linearBand(ratio: number, good: number, bad: number): number {
  if (ratio <= good) return 100
  if (ratio >= bad) return 0
  return 100 * ((bad - ratio) / (bad - good))
}

function labelFor(score: number): HealthScoreResult['label'] {
  if (score <= 39) return 'Frágil'
  if (score <= 59) return 'En construcción'
  if (score <= 79) return 'Estable'
  return 'Sólida'
}

const pct = (r: number) => Math.round(r * 100)
const round = (n: number) => Math.round(n * 100) / 100

/**
 * INS-02: an explainable health score. Each component says, in words, what it measured. A component
 * without data is "not measured": it does not drag the score down, and its weight goes to the others.
 * With too little history there is no score at all.
 */
export function computeHealthScore(
  txs: EngineTransaction[],
  asOf: Date,
  opts?: {
    anchors?: AccountAnchor[]
    recurring?: RecurringItemInput[]
    weights?: ScoreWeights
  },
): HealthScoreResult {
  const weights = opts?.weights ?? DEFAULT_SCORE_WEIGHTS
  // Empty months are not "zero income": they are months with nothing registered.
  const months = trailingFullMonths(txs, asOf, 3).filter((m) => m.count > 0)
  const income = mean(months.map((m) => m.income))
  const expenses = mean(months.map((m) => m.expenses))
  const evidence = txs.slice(0, 40).map((t) => t.id)
  const hasIncome = income > 0

  const savingsRate = hasIncome ? (income - expenses) / income : 0
  const savingsSub = clamp(savingsRate / 0.2, 0, 1) * 100

  const liquidAnchors = (opts?.anchors ?? []).filter(
    (a) => a.anchorBalance != null && (a.kind === 'checking' || a.kind === 'savings' || a.kind === 'cash' || a.kind === 'wallet'),
  )
  const liquid = liquidAnchors.reduce((s, a) => s + (a.anchorBalance ?? 0), 0)
  const monthsCovered = expenses > 0 ? liquid / expenses : 0
  const liquiditySub = clamp(monthsCovered / 3, 0, 1) * 100

  // Within the same months as everything else, not the whole history.
  const debtPay = mean(months.map((m) => Object.entries(m.byCategory).filter(([slug]) => DEBT.has(slug)).reduce((s, [, v]) => s + v, 0)))
  const debtRatio = hasIncome ? debtPay / income : 0
  const debtSub = linearBand(debtRatio, 0.1, 0.4)

  const discMonths = months.map((m) =>
    Object.entries(m.byCategory)
      .filter(([slug]) => DISCRETIONARY.has(slug))
      .reduce((s, [, v]) => s + v, 0),
  )
  const discMean = mean(discMonths)
  const cv = discMean > 0 ? stdev(discMonths) / discMean : 0
  const stabilitySub = clamp(1 - cv / 0.5, 0, 1) * 100

  const recMonthly = (opts?.recurring ?? []).reduce((s, r) => {
    const factor =
      r.frequency === 'weekly' ? 4.33 :
      r.frequency === 'biweekly' ? 2.17 :
      r.frequency === 'annual' ? 1 / 12 : 1
    return s + r.typicalAmount * factor
  }, 0)
  const recRatio = hasIncome ? recMonthly / income : 0
  const commitmentsSub = linearBand(recRatio, 0.3, 0.7)

  const notMeasured = 'No cuenta en tu puntaje.'
  const draft: Array<Omit<ScoreComponent, 'weight'> & { baseWeight: number }> = [
    {
      key: 'savings_rate',
      label: 'Tasa de ahorro',
      baseWeight: weights.savingsRate,
      measured: hasIncome,
      subScore: savingsSub,
      inputs: { income, expenses, savingsRate },
      explanation: hasIncome
        ? savingsRate >= 0
          ? `Te queda el ${pct(savingsRate)}% de lo que entra (${solesText(round(income - expenses))} de ${solesText(round(income))} al mes). Lo sano es 20% o más.`
          : `Gastas más de lo que entra: ${solesText(round(expenses - income))} al mes por encima de tus ingresos.`
        : `Sin ingresos registrados no puedo medirlo. ${notMeasured}`,
      evidenceTxnIds: evidence,
    },
    {
      key: 'liquidity_buffer',
      label: 'Colchón',
      baseWeight: weights.liquidityBuffer,
      measured: liquidAnchors.length > 0 && expenses > 0,
      subScore: liquiditySub,
      inputs: { liquid, expenses, monthsCovered },
      explanation:
        liquidAnchors.length > 0 && expenses > 0
          ? `Tus cuentas cubren ${round(monthsCovered)} meses de gastos. Lo ideal son 3.`
          : `Necesito los saldos de tus cuentas para medirlo. ${notMeasured}`,
      evidenceTxnIds: evidence,
    },
    {
      key: 'debt_load',
      label: 'Deudas',
      baseWeight: weights.debtLoad,
      measured: hasIncome,
      subScore: debtSub,
      inputs: { debtPay, income, debtRatio },
      explanation: !hasIncome
        ? `Sin ingresos registrados no puedo compararlo. ${notMeasured}`
        : debtPay > 0
          ? `Pagas ${solesText(round(debtPay))} al mes en deudas, el ${pct(debtRatio)}% de lo que entra. Hasta 10% es sano; sobre 40% aprieta.`
          : 'No veo pagos de deudas en tus últimos meses.',
      evidenceTxnIds: evidence,
    },
    {
      key: 'spending_stability',
      label: 'Gasto estable',
      baseWeight: weights.spendingStability,
      measured: months.length >= MIN_STABILITY_MONTHS && discMean > 0,
      subScore: stabilitySub,
      inputs: { cv, discMean },
      explanation:
        months.length >= MIN_STABILITY_MONTHS && discMean > 0
          ? `Tu gasto del día a día varía un ${pct(cv)}% de un mes a otro (promedio ${solesText(round(discMean))}). Menos variación, menos sorpresas.`
          : `Necesito ${MIN_STABILITY_MONTHS} meses de gastos para compararlos. ${notMeasured}`,
      evidenceTxnIds: evidence,
    },
    {
      key: 'commitments',
      label: 'Pagos fijos',
      baseWeight: weights.commitments,
      measured: hasIncome,
      subScore: commitmentsSub,
      inputs: { recMonthly, income, recRatio },
      explanation: !hasIncome
        ? `Sin ingresos registrados no puedo compararlo. ${notMeasured}`
        : recMonthly > 0
          ? `Tus pagos fijos son ${solesText(round(recMonthly))} al mes, el ${pct(recRatio)}% de lo que entra. Hasta 30% es cómodo.`
          : 'No detecto pagos fijos que se repitan cada mes.',
      evidenceTxnIds: evidence,
    },
  ]

  const measuredWeight = draft.filter((c) => c.measured).reduce((s, c) => s + c.baseWeight, 0)
  const components: ScoreComponent[] = draft.map(({ baseWeight, ...c }) => ({
    ...c,
    // Weights of what was not measured are shared among what was.
    weight: c.measured && measuredWeight > 0 ? baseWeight / measuredWeight : 0,
  }))
  const sufficient = months.length >= MIN_SCORE_MONTHS && hasIncome && measuredWeight > 0
  const score = sufficient ? clamp(Math.round(components.reduce((s, c) => s + c.weight * c.subScore, 0)), 0, 100) : 0

  const from = months[0]
    ? `${fromYearMonth(months[0].year, months[0].month)}`
    : isoDate(startOfMonth(asOf))
  const to = isoDate(asOf)

  return {
    score,
    sufficient,
    monthsUsed: months.length,
    label: sufficient ? labelFor(score) : 'Sin datos suficientes',
    components,
    engineVersion: ENGINE_VERSION,
    periodFrom: from,
    periodTo: to,
  }
}

function fromYearMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}
