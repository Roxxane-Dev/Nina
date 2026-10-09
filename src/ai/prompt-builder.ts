import type { AIInput, Memory, Prompt, UserInsights } from './ai.types'
import {
  MEMORY_CHAR_BUDGET,
  dedupeMemories,
  limitMemoriesByPlan,
  truncateMemories,
} from './memory-utils'

// ─── Nina's voice ─────────────────────────────────────────────────────────────

const NINA_SYSTEM_BASE = `Eres Nina, una asistente financiera personal.

Hablas en español.

Tu tono:
- Claro y directo
- Útil
- Ligero y humano
- Con un toque de humor sutil (no sarcasmo)

Reglas:
- No juzgas al usuario
- No eres agresiva
- Puedes hacer comentarios ligeros sobre hábitos
- Siempre priorizas ayudar
- Usa datos reales (gastos, insights)
- NUNCA inventes números
- Si el usuario pregunta por una categoría específica, búscala en DESGLOSE POR CATEGORÍA y responde con ese número exacto
- Si la categoría no está en el desglose, di que no hay gastos registrados en esa categoría
- Prefiere hechos sobre bromas
- Mantén las respuestas cortas
- Evita emojis a menos que sea muy sutil (máximo 1)

Prioridad de respuesta:
1. Exactitud (usa siempre los números del bloque CONTEXTO FINANCIERO)
2. Claridad
3. Utilidad
4. Personalidad (al final)`

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatInsightsBlock(insights?: UserInsights | null): string {
  if (!insights) return ''

  const lines = [
    `CONTEXTO FINANCIERO DEL USUARIO (usa estos números para responder):`,
    `- Gasto este mes: $${insights.monthly_spending.toFixed(2)}`,
    `- Mes anterior: $${insights.previous_month_spending.toFixed(2)}`,
    `- Tendencia: ${insights.trend === 'up' ? '⬆️ subiendo' :
      insights.trend === 'down' ? '⬇️ bajando' :
        '➡️ estable'
    }`,
    `- Proyección fin de mes: $${insights.forecast_end_of_month?.toFixed(2) ?? 'N/A'}`,
    `- Categoría principal: ${insights.top_category ?? 'N/A'}`,
  ]

  // ← ESTO ES LO QUE FALTABA: desglose por categoría
  const breakdown = insights.by_category ?? (insights as any).category_breakdown
  if (breakdown && Object.keys(breakdown).length > 0) {
    lines.push(`\nDESGLOSE POR CATEGORÍA (este mes):`)
    Object.entries(breakdown)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .forEach(([cat, amount]) => {
        lines.push(`  · ${cat}: $${(amount as number).toFixed(2)}`)
      })
  }

  const isOverBudget = insights.budget_status?.over_budget ?? (insights as any).over_budget
  const isWarning = insights.budget_status?.warning ?? (insights as any).warning

  if (isOverBudget) {
    lines.push(`\nALERTA: El usuario está sobre su presupuesto. Menciona esto con tacto, sin juzgar.`)
  } else if (isWarning) {
    lines.push(`\nAVISO: Va camino a superar el gasto del mes pasado. Haz un comentario ligero.`)
  }

  return `\n\n${lines.join('\n')}`
}

function formatMemoriesBlock(memories: Memory[]): string {
  if (memories.length === 0) return ''

  const lines = memories.map((m) => {
    let label = 'Usuario'
    if (m.role === 'assistant') label = 'Nina'
    else if (m.role === 'pattern') label = 'PATRÓN DETECTADO'
    return `${label}: ${m.content}`
  })

  return `\n\nMEMORIA (conversaciones anteriores y patrones):\n${lines.join('\n')}`
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildPrompt(input: AIInput): Prompt {
  const plan = input.plan === 'premium' ? 'premium' : 'free'

  let system = input.ninaSnapshotPrompt ?? NINA_SYSTEM_BASE

  if (!input.ninaSnapshotPrompt && input.insights) {
    system += formatInsightsBlock(input.insights)
  }

  const rawMemories = input.memories ?? []
  const merged = dedupeMemories(rawMemories)
  const capped = limitMemoriesByPlan(merged, plan)
  const budget = MEMORY_CHAR_BUDGET[plan]
  const memoriesForPrompt = truncateMemories(capped, budget)

  system += formatMemoriesBlock(memoriesForPrompt)

  return {
    system,
    messages: [{ role: 'user', content: input.message }],
  }
}