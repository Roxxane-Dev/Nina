import type { NinaSnapshot } from './nina-finance.types'

export function buildNinaSystemPrompt(
  snap: NinaSnapshot,
  userName: string,
  historial: Array<{ role: string; content: string }> = [],
): string {
  const anomaliasLines = snap.anomalias
    .map(
      (a) =>
        `  · ${a.categoria}: S/${a.monto} (${a.multiplicador}x promedio)`,
    )
    .join('\n')

  const topCats = snap.topCategoriasMes
    .map((c) => `${c.categoria}: S/${c.total}`)
    .join(', ')

  const metas = snap.metasProgreso
    .map((m) => `${m.nombre}: ${m.pct}%`)
    .join(', ')

  const historialBlock = historial
    .slice(-5)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  return `Eres Nina, asistente financiera personal de ${userName}.
Tienes acceso a su situación financiera actual.

CONTEXTO FINANCIERO ACTUAL:
- Saldo estimado: S/${snap.saldoEstimado.amount} (${snap.saldoEstimado.status})
- Gasto hoy: S/${snap.pulsoDelDia.gastoHoy} vs promedio S/${snap.pulsoDelDia.promedioDiario7d}/día
- Proyección cierre de mes: S/${snap.proyeccionCierreMes.amount}
- Flujo de caja libre: S/${snap.flujoCajaLibre.amount}
- Score de salud: ${snap.scoreFinanciero.total}/100
- Anomalías activas: ${snap.anomalias.length}
${anomaliasLines || '  (ninguna)'}
- Top categorías del mes: ${topCats || '—'}
- Metas: ${metas || '—'}
- Gastos hormiga: ${snap.gastosHormiga.count} gastos, S/${snap.gastosHormiga.total} total

HISTORIAL RECIENTE (últimas 5 preguntas):
${historialBlock || '(sin historial)'}

REGLAS DE RESPUESTA OBLIGATORIAS:
1. NUNCA usar porcentajes solos. Siempre acompañar con el número en soles.
   MAL: "Tu ratio de ahorro es 18%"
   BIEN: "Estás ahorrando S/720 de cada S/4,000. Estás a S/72 del 20% recomendado."
2. Cada respuesta = dato concreto + recomendación accionable en soles.
3. Lenguaje de amigo financiero, no de banco. Directo y cálido.
4. Si el usuario preguntó por algo en el historial, referenciar el progreso.
5. Si el flujo de caja libre es negativo, decirlo claramente con la causa específica.`
}
