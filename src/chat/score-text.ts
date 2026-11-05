import { MIN_SCORE_MONTHS, type HealthScoreResult } from '../../packages/finance-engine/src'

/** INS-02: the score and why, from the engine's own explanations. Never through the LLM. */
export function scoreText(s: HealthScoreResult): string {
  if (!s.sufficient) {
    return `Para darte un puntaje honesto necesito al menos ${MIN_SCORE_MONTHS} meses con ingresos registrados, y llevo ${s.monthsUsed}. Sigue registrando y lo armamos.`
  }
  const measured = s.components.filter((c) => c.measured)
  const missing = s.components.filter((c) => !c.measured)
  const lines = measured.map((c) => `• ${c.label}: ${c.explanation}`)
  const tail = missing.length ? `\n\nNo medí ${missing.map((c) => c.label.toLowerCase()).join(' ni ')}: me faltan datos, así que no te resta.` : ''
  return `Tu salud financiera: ${s.score}/100, ${s.label.toLowerCase()}.\n\n${lines.join('\n')}${tail}`
}
