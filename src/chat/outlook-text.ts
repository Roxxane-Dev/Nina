import type { MonthOutlook } from '../../packages/finance-engine/src'
import { formatSoles } from '../common/money'

/**
 * INS-03: the month-end projection with every assumption visible. Built from the engine's parts
 * only, never through the LLM: a projection explained in free text would invite invented numbers.
 */
export function outlookText(o: MonthOutlook): string {
  const head =
    o.projected >= 0
      ? `Si sigues como vas, cerrarías ${o.monthLabel} con unos ${formatSoles(o.projected)}.`
      : `Si sigues como vas, ${o.monthLabel} cerraría en ${formatSoles(o.projected)}.`
  const lines = [`• Hoy tienes ${formatSoles(o.availableNow)} disponibles.`]
  if (o.expectedIncome > 0) {
    lines.push(`• + ${formatSoles(o.expectedIncome)} de ingreso, que suele llegar${o.incomeDay ? ` el día ${o.incomeDay}` : ''}.`)
  }
  if (o.overdueIncome > 0) {
    lines.push(`• Tu ingreso de siempre (unos ${formatSoles(o.overdueIncome)}) no está registrado y ya pasó su día, así que no lo cuento.`)
  }
  if (o.recurringUntilEnd > 0) lines.push(`• − ${formatSoles(o.recurringUntilEnd)} de pagos fijos que se vienen.`)
  lines.push(
    `• − ${formatSoles(o.discretionaryUntilEnd)} del día a día: unos ${formatSoles(o.dailySpend)} diarios por ${o.daysLeft} ${o.daysLeft === 1 ? 'día' : 'días'}.`,
  )
  return `${head}\n\nAsí lo calculo:\n${lines.join('\n')}\n\nEs una estimación con lo que registraste, no una promesa.`
}
