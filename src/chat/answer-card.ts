import type { FactsIntent, FactsPayload } from '../../packages/finance-engine/src'
export { formatSoles } from '../common/money'

/** Visual result card (FDS §6.4). Built from engine facts only — never from LLM text. */
export type AnswerCard = {
  title: string
  subtitle: string
  highlight?: { label: string; amount: number; tone: 'positive' | 'negative' | 'neutral' }
  rows: Array<{ label: string; amount: number; tone?: 'positive' | 'negative' }>
  /** "Cómo lo calculé": period, movements and engine version. */
  howCalculated: string
  confidence: FactsPayload['confidence']
}

export type RecentItem = { date: string; category: string; amount: number; isIncome: boolean }

export function buildCard(facts: FactsPayload, recent?: RecentItem[]): AnswerCard | undefined {
  const f = facts.figures
  const ctx = facts.context
  const period = ctx?.periodLabel ?? `${facts.period.from} – ${facts.period.to}`
  const base = {
    subtitle: `${capitalize(period)} · ${facts.txnCount} movimiento${facts.txnCount === 1 ? '' : 's'}`,
    howCalculated:
      `Sumé tus movimientos registrados de ${period}` +
      (ctx?.requestedPeriodLabel ? ` (en ${ctx.requestedPeriodLabel} aún no tienes registros)` : '') +
      `. Las transferencias entre tus cuentas no cuentan. Motor ${facts.engineVersion}.`,
    confidence: facts.confidence,
  }

  switch (facts.intent) {
    case 'recent':
      if (!recent?.length) return undefined
      return {
        ...base,
        title: 'Tus últimos movimientos',
        subtitle: `${recent.length} más recientes`,
        rows: recent.map((r) => ({
          label: `${shortDate(r.date)} · ${r.category}`,
          amount: r.isIncome ? r.amount : -r.amount,
          tone: r.isIncome ? 'positive' : 'negative',
        })),
        howCalculated: 'Movimientos más recientes que registraste, del más nuevo al más antiguo.',
      }
    case 'balance':
      return {
        ...base,
        title: 'Tu saldo',
        subtitle: `Según tus movimientos registrados, ${period}`,
        highlight: { label: 'Saldo (ingresos − gastos)', amount: f.balance, tone: f.balance >= 0 ? 'positive' : 'negative' },
        rows: [
          { label: 'Total de ingresos', amount: f.total_income, tone: 'positive' },
          { label: 'Total de gastos', amount: -f.total_expenses, tone: 'negative' },
        ],
        howCalculated:
          `Sumé todos tus ingresos y les resté todos tus gastos registrados ${period} (${facts.txnCount} movimientos). ` +
          `No es el saldo de tu banco: solo incluye lo que registraste en Nina. Motor ${facts.engineVersion}.`,
      }
    case 'income':
      return {
        ...base,
        title: 'Tus ingresos',
        highlight: { label: 'Total ingresos', amount: f.income, tone: 'positive' },
        rows: (facts.items ?? []).map((i) => ({ label: i.label, amount: i.amount, tone: 'positive' as const })),
      }
    case 'available':
      return {
        ...base,
        title: 'Lo que te queda',
        highlight: { label: 'Disponible (ingresos − gastos)', amount: f.available, tone: f.available >= 0 ? 'positive' : 'negative' },
        rows: [
          { label: 'Ingresos', amount: f.income, tone: 'positive' },
          { label: 'Gastos', amount: -f.expenses, tone: 'negative' },
        ],
      }
    case 'category_spend':
      return {
        ...base,
        title: `Gasto en ${ctx?.categoryLabel ?? 'la categoría'}`,
        highlight: { label: 'Este periodo', amount: f.category_spend ?? 0, tone: 'neutral' },
        rows: [
          { label: 'Mes anterior', amount: f.category_prev ?? 0 },
          { label: 'Total de gastos del periodo', amount: f.expenses },
        ],
      }
    case 'help':
    case 'other':
    case 'whatif':
      return undefined
    default:
      return {
        ...base,
        title: 'Tu resumen',
        highlight: { label: 'Gastos', amount: f.expenses, tone: 'neutral' },
        rows: [
          ...(facts.items ?? []).slice(0, 5).map((i) => ({ label: i.label, amount: i.amount })),
          { label: 'Ingresos', amount: f.income, tone: 'positive' as const },
          { label: 'Disponible', amount: f.available, tone: f.available >= 0 ? ('positive' as const) : ('negative' as const) },
        ],
      }
  }
}

const FOLLOW_UPS: Partial<Record<FactsIntent, string[]>> = {
  spending_summary: ['¿En qué gasto más?', '¿Cuánto me queda?', '¿Y el mes pasado?'],
  spending_breakdown: ['¿Cuánto gasté en comida?', '¿Cuánto me queda?', 'Muéstrame mis últimos gastos'],
  category_spend: ['¿En qué gasto más?', '¿Cómo puedo ahorrar más?', '¿Cuánto me queda?'],
  income: ['¿Cuánto me queda?', '¿En qué gasto más?', '¿Cuánto gasté este mes?'],
  balance: ['¿Cuánto gasté este mes?', '¿En qué gasto más?', 'Muéstrame mis últimos gastos'],
  available: ['¿En qué gasto más?', 'Muéstrame mis últimos gastos', '¿Cómo puedo ahorrar más?'],
  recent: ['¿Cuánto gasté este mes?', '¿En qué gasto más?', '¿Cuánto me queda?'],
  help: ['¿Cuánto gasté este mes?', 'Gasté 25 en taxi', 'Me pagaron 3500 de sueldo'],
}

export function suggestedFollowUps(intent: FactsIntent): string[] {
  return FOLLOW_UPS[intent] ?? ['¿Cuánto gasté este mes?', '¿En qué gasto más?', '¿Cuánto me queda?']
}

export const HELP_REPLY =
  'Soy Nina, tu agente financiero. Puedo:\n' +
  '• Registrar gastos e ingresos: "gasté 25 en taxi", "me pagaron 3500".\n' +
  '• Decirte cuánto gastaste, en qué y cuánto te queda: "¿en qué gasto más?".\n' +
  '• Compararte con el mes pasado o un mes específico: "¿cuánto gasté en julio?".\n' +
  '• Mostrarte tus últimos movimientos y darte una recomendación concreta.\n' +
  'Todas las cifras salen de tus movimientos registrados; nunca invento números.'

export const NO_DATA_REPLY =
  'Aún no tienes movimientos registrados, así que no puedo darte cifras todavía. ' +
  'Empieza contándome uno: "gasté 25 en taxi" o "me pagaron 3500 de sueldo".'

function shortDate(iso: string): string {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${months[m - 1]}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
