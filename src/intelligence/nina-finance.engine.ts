import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createAdminClient } from '../common/supabase.client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FinanceGoal,
  FinanceSubscription,
  FinanceTransaction,
  NinaSnapshot,
} from './nina-finance.types'

const DISCRETIONARY = new Set([
  'food',
  'transport',
  'entertainment',
  'shopping',
  'comida',
  'café',
  'cafe',
  'snacks',
  'delivery',
  'transporte',
  'entretenimiento',
])

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

const NETFLIX_REF = 35

@Injectable()
export class NinaFinanceEngine implements OnModuleInit {
  private readonly logger = new Logger(NinaFinanceEngine.name)
  private db!: SupabaseClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')
    if (url && key) {
      this.db = createAdminClient(url, key)
      this.logger.log('[NinaFinanceEngine] Supabase client ready')
    }
  }

  async getSnapshot(userId: string): Promise<NinaSnapshot> {
    const [txs, subscriptions, goals] = await Promise.all([
      this.loadTransactions(userId),
      this.loadSubscriptions(userId),
      this.loadGoals(userId),
    ])

    const expenses = txs.filter((t) => t.type === 'expense')
    const compromisos = this.compromisosPendientes(txs, subscriptions)
    const saldo = this.saldoEstimado(txs, subscriptions)
    const pulso = this.pulsoDelDia(txs)
    const proyeccion = this.proyeccionCierreMes(txs, subscriptions)
    const anomalias = this.detectarAnomalias(txs)
    const tendenciaMap = this.tendenciaCategorias(txs)
    const tendenciaCategorias = Object.fromEntries(tendenciaMap)
    const gastosHormiga = this.gastosHormiga(txs)
    const patrones = this.patronesComportamiento(txs)
    const flujoCajaLibre = this.flujoCajaLibre(txs, subscriptions)
    const scoreFinanciero = this.scoreFinanciero(txs, goals)
    const topCategoriasMes = this.topCategoriasMes(txs)
    const metasProgreso = this.metasProgreso(goals)

    return {
      saldoEstimado: saldo,
      pulsoDelDia: pulso,
      proyeccionCierreMes: proyeccion,
      compromisosPendientes: compromisos,
      anomalias,
      tendenciaCategorias,
      gastosHormiga,
      patrones,
      flujoCajaLibre,
      scoreFinanciero,
      topCategoriasMes,
      metasProgreso,
    }
  }

  saldoEstimado(
    txs: FinanceTransaction[],
    subscriptions: FinanceSubscription[],
  ): NinaSnapshot['saldoEstimado'] {
    const incomes = txs.filter((t) => t.type === 'income')
    const expenses = txs.filter((t) => t.type === 'expense')
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0)
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
    const compromisos = this.compromisosPendientes(txs, subscriptions)
    const promedio7 = this.avgDailyExpense7d(expenses)
    const diasRest = this.daysRemainingInMonth()
    const reserva = promedio7 * diasRest
    const amount =
      totalIncome - totalExpense - compromisos.total - reserva

    const margen = amount - compromisos.total
    let status: 'green' | 'yellow' | 'red' = 'green'
    if (amount < 0) status = 'red'
    else if (margen < 200) status = 'yellow'

    return {
      amount: Math.round(amount * 100) / 100,
      status,
      tooltip:
        'Ingresos registrados − gastos − compromisos pendientes − reserva estimada',
    }
  }

  pulsoDelDia(txs: FinanceTransaction[]): NinaSnapshot['pulsoDelDia'] {
    const today = this.todayUtc()
    const expenses = txs.filter((t) => t.type === 'expense')
    const gastoHoy = expenses
      .filter((t) => t.date === today)
      .reduce((s, t) => s + t.amount, 0)

    const last7 = this.lastNDaysUtc(7)
    const gasto7 = expenses
      .filter((t) => last7.includes(t.date))
      .reduce((s, t) => s + t.amount, 0)
    const promedioDiario7d = gasto7 / 7

    const deltaPct =
      promedioDiario7d > 0
        ? ((gastoHoy - promedioDiario7d) / promedioDiario7d) * 100
        : 0

    let diasBajoPromedio = 0
    for (let i = 0; i < 30; i++) {
      const d = this.addDaysUtc(today, -i)
      const daySpend = expenses
        .filter((t) => t.date === d)
        .reduce((s, t) => s + t.amount, 0)
      if (daySpend < promedioDiario7d) diasBajoPromedio++
      else break
    }

    return {
      gastoHoy: Math.round(gastoHoy * 100) / 100,
      promedioDiario7d: Math.round(promedioDiario7d * 100) / 100,
      deltaPct: Math.round(deltaPct * 10) / 10,
      diasBajoPromedio,
    }
  }

  proyeccionCierreMes(
    txs: FinanceTransaction[],
    subscriptions: FinanceSubscription[],
  ): NinaSnapshot['proyeccionCierreMes'] {
    const saldo = this.saldoEstimado(txs, subscriptions)
    const expenses = txs.filter((t) => t.type === 'expense')
    const promedio7 = this.avgDailyExpense7d(expenses)
    const diasRest = this.daysRemainingInMonth()
    const compromisos = this.compromisosPendientes(txs, subscriptions)
    const amount =
      saldo.amount - promedio7 * diasRest - compromisos.total

    const margen = amount - compromisos.total
    let status: 'green' | 'yellow' | 'red' = 'green'
    if (amount < 0 || margen < 0) status = 'red'
    else if (margen < 200) status = 'yellow'

    return {
      amount: Math.round(amount * 100) / 100,
      status,
      diasRestantes: diasRest,
    }
  }

  compromisosPendientes(
    txs: FinanceTransaction[],
    subscriptions: FinanceSubscription[],
  ): NinaSnapshot['compromisosPendientes'] {
    const items: NinaSnapshot['compromisosPendientes']['items'] = []
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const monthEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(
      new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
    ).padStart(2, '0')}`

    const monthExpenses = txs.filter(
      (t) =>
        t.type === 'expense' &&
        t.date >= monthStart &&
        t.date <= monthEnd,
    )

    for (const sub of subscriptions.filter((s) => s.is_active !== false)) {
      const name = sub.name ?? 'Suscripción'
      const amount = Number(sub.amount) || 0
      const paid = monthExpenses.some(
        (t) =>
          Math.abs(t.amount - amount) / (amount || 1) <= 0.15 ||
          (t.description?.toLowerCase().includes(name.toLowerCase()) ?? false) ||
          t.category === sub.category,
      )
      if (!paid) {
        const due =
          sub.next_billing_date ??
          `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(28, now.getUTCDate() + 7)).padStart(2, '0')}`
        items.push({
          nombre: name,
          monto: amount,
          fechaVencimiento: due,
          fuente: 'subscription',
        })
      }
    }

    const recurrentes = this.detectRecurrentCommitments(txs)
    for (const r of recurrentes) {
      if (!items.some((i) => i.nombre === r.nombre && Math.abs(i.monto - r.monto) < 1)) {
        items.push(r)
      }
    }

    const total = items.reduce((s, i) => s + i.monto, 0)
    return { total: Math.round(total * 100) / 100, items }
  }

  detectarAnomalias(txs: FinanceTransaction[]): NinaSnapshot['anomalias'] {
    const expenses = txs.filter((t) => t.type === 'expense')
    const cutoff = this.addDaysUtc(this.todayUtc(), -90)
    const recent = expenses.filter((t) => t.date >= cutoff)
    const byCat = new Map<string, number[]>()
    for (const t of recent) {
      const cat = t.category || 'other'
      if (!byCat.has(cat)) byCat.set(cat, [])
      byCat.get(cat)!.push(t.amount)
    }

    const stats = new Map<string, { mean: number; std: number }>()
    for (const [cat, amounts] of byCat) {
      if (amounts.length < 5) continue
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
      const variance =
        amounts.reduce((s, x) => s + (x - mean) ** 2, 0) / amounts.length
      const std = Math.sqrt(variance) || 1
      stats.set(cat, { mean, std })
    }

    const monthStart = this.currentMonthStart()
    const thisMonth = expenses.filter((t) => t.date >= monthStart)
    const results: NinaSnapshot['anomalias'] = []

    for (const t of thisMonth) {
      const cat = t.category || 'other'
      const st = stats.get(cat)
      if (!st) continue
      const z = (t.amount - st.mean) / st.std
      if (z > 1.5 && t.amount > 30) {
        results.push({
          transactionId: t.id,
          categoria: cat,
          monto: t.amount,
          zScore: Math.round(z * 100) / 100,
          multiplicador: Math.round((t.amount / st.mean) * 10) / 10,
          mediaCategoria: Math.round(st.mean * 100) / 100,
          descripcion: t.description ?? '',
          fecha: t.date,
        })
      }
    }
    return results
  }

  tendenciaCategorias(
    txs: FinanceTransaction[],
  ): Map<string, NinaSnapshot['tendenciaCategorias'][string]> {
    const expenses = txs.filter((t) => t.type === 'expense')
    const now = new Date()
    const curY = now.getUTCFullYear()
    const curM = now.getUTCMonth()
    const prev = new Date(Date.UTC(curY, curM - 1, 1))
    const prevY = prev.getUTCFullYear()
    const prevM = prev.getUTCMonth()

    const curStart = `${curY}-${String(curM + 1).padStart(2, '0')}-01`
    const prevStart = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`
    const prevEnd = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(
      new Date(Date.UTC(prevY, prevM + 1, 0)).getUTCDate(),
    ).padStart(2, '0')}`

    const sumInRange = (from: string, to: string) => {
      const sums = new Map<string, number>()
      for (const t of expenses) {
        if (t.date >= from && t.date <= to) {
          const c = t.category || 'other'
          sums.set(c, (sums.get(c) ?? 0) + t.amount)
        }
      }
      return sums
    }

    const curEnd = `${curY}-${String(curM + 1).padStart(2, '0')}-${String(
      new Date(Date.UTC(curY, curM + 1, 0)).getUTCDate(),
    ).padStart(2, '0')}`
    const actual = sumInRange(curStart, curEnd)
    const anterior = sumInRange(prevStart, prevEnd)

    const map = new Map<string, NinaSnapshot['tendenciaCategorias'][string]>()
    for (const cat of new Set([...actual.keys(), ...anterior.keys()])) {
      const mesActual = actual.get(cat) ?? 0
      const mesAnterior = anterior.get(cat) ?? 0
      if (mesActual === 0 && mesAnterior === 0) continue
      const pctCambio =
        mesAnterior > 0
          ? ((mesActual - mesAnterior) / mesAnterior) * 100
          : mesActual > 0
            ? 100
            : 0
      let direction: 'up' | 'down' | 'stable' = 'stable'
      if (pctCambio > 5) direction = 'up'
      else if (pctCambio < -5) direction = 'down'
      map.set(cat, {
        mesActual: Math.round(mesActual * 100) / 100,
        mesAnterior: Math.round(mesAnterior * 100) / 100,
        pctCambio: Math.round(pctCambio * 10) / 10,
        direction,
      })
    }
    return map
  }

  gastosHormiga(txs: FinanceTransaction[]): NinaSnapshot['gastosHormiga'] {
    const expenses = txs.filter(
      (t) =>
        t.type === 'expense' &&
        t.amount < 30 &&
        DISCRETIONARY.has((t.category || '').toLowerCase()),
    )
    const weekStart = this.addDaysUtc(this.todayUtc(), -7)
    const semanaItems = expenses.filter((t) => t.date >= weekStart)
    const total = semanaItems.reduce((s, t) => s + t.amount, 0)
    const mesesNetflix = total / NETFLIX_REF
    const comparacionConcreta =
      mesesNetflix >= 0.5
        ? `= ${mesesNetflix.toFixed(1)} meses de Netflix (S/${NETFLIX_REF}/mes)`
        : '= menos de medio mes de Netflix'

    return {
      count: semanaItems.length,
      total: Math.round(total * 100) / 100,
      semanaActual: Math.round(total * 100) / 100,
      comparacionConcreta,
      items: semanaItems.slice(0, 50),
    }
  }

  patronesComportamiento(txs: FinanceTransaction[]): NinaSnapshot['patrones'] {
    const expenses = txs.filter((t) => t.type === 'expense')
    const byDow = Array(7).fill(0) as number[]
    const counts = Array(7).fill(0) as number[]
    for (const t of expenses) {
      const d = new Date(t.date + 'T12:00:00Z')
      const dow = d.getUTCDay()
      byDow[dow] += t.amount
      counts[dow]++
    }
    let diaMayorGasto = 'Viernes'
    let maxAvg = 0
    for (let i = 0; i < 7; i++) {
      const avg = counts[i] > 0 ? byDow[i] / counts[i] : 0
      if (avg > maxAvg) {
        maxAvg = avg
        diaMayorGasto = DAY_NAMES[i]
      }
    }

    const tendencias = this.tendenciaCategorias(txs)
    let categoriaMayorCrecimiento = { nombre: '—', pctCambio: 0 }
    for (const [cat, t] of tendencias) {
      if (t.pctCambio > categoriaMayorCrecimiento.pctCambio) {
        categoriaMayorCrecimiento = {
          nombre: cat,
          pctCambio: t.pctCambio,
        }
      }
    }

    const gastoHormigas = this.gastosHormiga(txs)
    return { diaMayorGasto, categoriaMayorCrecimiento, gastoHormigas }
  }

  flujoCajaLibre(
    txs: FinanceTransaction[],
    subscriptions: FinanceSubscription[],
  ): NinaSnapshot['flujoCajaLibre'] {
    const last3 = this.lastNMonthsUtc(3)
    let incomeSum = 0
    let variableSum = 0
    for (const range of last3) {
      incomeSum += txs
        .filter(
          (t) =>
            t.type === 'income' &&
            t.date >= range.start &&
            t.date <= range.end,
        )
        .reduce((s, t) => s + t.amount, 0)
      variableSum += txs
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.date >= range.start &&
            t.date <= range.end,
        )
        .reduce((s, t) => s + t.amount, 0)
    }
    const ingresoPromedio3m = incomeSum / 3
    const promedioVariables3m = variableSum / 3
    const compromisos = this.compromisosPendientes(txs, subscriptions)
    const gastosFijosRecurrentes =
      subscriptions
        .filter((s) => s.is_active !== false)
        .reduce((s, sub) => s + (Number(sub.amount) || 0), 0) +
      compromisos.items
        .filter((i) => i.fuente === 'recurrente_detectado')
        .reduce((s, i) => s + i.monto, 0)

    const amount =
      ingresoPromedio3m - gastosFijosRecurrentes - promedioVariables3m
    const gastoTotal = gastosFijosRecurrentes + promedioVariables3m
    const ratioAhorro =
      ingresoPromedio3m > 0
        ? (ingresoPromedio3m - gastoTotal) / ingresoPromedio3m
        : 0
    const ratioAhorroPct = Math.round(ratioAhorro * 1000) / 10
    const ahorroSoles = ingresoPromedio3m - gastoTotal
    const gap20 = Math.max(0, ingresoPromedio3m * 0.2 - ahorroSoles)
    const mensajeNatural =
      ingresoPromedio3m > 0
        ? `Estás ahorrando S/${Math.round(ahorroSoles)} de cada S/${Math.round(ingresoPromedio3m)} que recibes. Estás a S/${Math.round(gap20)} del 20%.`
        : 'Registra tus ingresos para calcular tu flujo de caja libre.'

    return {
      amount: Math.round(amount * 100) / 100,
      isNegative: amount < 0,
      ingresoPromedio3m: Math.round(ingresoPromedio3m * 100) / 100,
      gastosFijosRecurrentes: Math.round(gastosFijosRecurrentes * 100) / 100,
      promedioVariables3m: Math.round(promedioVariables3m * 100) / 100,
      ratioAhorro: Math.round(ratioAhorro * 1000) / 1000,
      ratioAhorroPct,
      mensajeNatural,
    }
  }

  scoreFinanciero(
    txs: FinanceTransaction[],
    goals: FinanceGoal[],
  ): NinaSnapshot['scoreFinanciero'] {
    const { f1, f2, f3 } = this.scoreFactors123(txs, goals)
    const currentCore = f1 + f2 + f3
    const prevScores = this.historicalCoreScores(txs, goals)
    let f4 = 10
    if (prevScores.length > 0) {
      const avgPrev =
        prevScores.reduce((a, b) => a + b, 0) / prevScores.length
      const delta = avgPrev > 0 ? (currentCore - avgPrev) / avgPrev : 0
      if (delta > 0.05) f4 = 20
      else if (delta >= -0.05) f4 = 14
      else f4 = 6
    }

    const total = Math.min(100, f1 + f2 + f3 + f4)
    let status: 'green' | 'orange' | 'red' = 'green'
    if (total < 60) status = 'red'
    else if (total < 80) status = 'orange'

    const factores: NinaSnapshot['scoreFinanciero']['factores'] = [
      {
        nombre: 'Ratio ahorro/ingreso',
        puntos: f1,
        maxPuntos: 30,
        microAccion:
          f1 < 18
            ? 'Registra todos tus ingresos para mejorar este indicador.'
            : null,
      },
      {
        nombre: 'Estabilidad del gasto',
        puntos: f2,
        maxPuntos: 25,
        microAccion:
          f2 < 14
            ? 'Registra gastos diariamente por 2 semanas para estabilizar.'
            : null,
      },
      {
        nombre: 'Cumplimiento de metas',
        puntos: f3,
        maxPuntos: 25,
        microAccion:
          f3 < 15
            ? 'Abona aunque sea S/50 a tu meta más próxima.'
            : null,
      },
      {
        nombre: 'Tendencia',
        puntos: f4,
        maxPuntos: 20,
        microAccion:
          f4 < 14
            ? 'Revisa qué categoría creció más este mes.'
            : null,
      },
    ]

    const deltaMesAnterior =
      prevScores.length > 0 ? total - (prevScores[0] ?? 0) : 0

    return {
      total,
      status,
      factores,
      deltaMesAnterior,
    }
  }

  private topCategoriasMes(
    txs: FinanceTransaction[],
  ): NinaSnapshot['topCategoriasMes'] {
    const start = this.currentMonthStart()
    const expenses = txs.filter(
      (t) => t.type === 'expense' && t.date >= start,
    )
    const sums = new Map<string, number>()
    for (const t of expenses) {
      const c = t.category || 'other'
      sums.set(c, (sums.get(c) ?? 0) + t.amount)
    }
    const total = [...sums.values()].reduce((a, b) => a + b, 0) || 1
    return [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoria, t]) => ({
        categoria,
        total: Math.round(t * 100) / 100,
        pct: Math.round((t / total) * 1000) / 10,
      }))
  }

  private metasProgreso(goals: FinanceGoal[]): NinaSnapshot['metasProgreso'] {
    return goals
      .filter((g) => g.status === 'active' || !g.status)
      .map((g) => {
        const target = Number(g.target_amount) || 1
        const current = Number(g.current_amount) || 0
        return {
          nombre: g.name,
          current,
          target,
          pct: Math.round((current / target) * 1000) / 10,
        }
      })
  }

  private detectRecurrentCommitments(
    txs: FinanceTransaction[],
  ): NinaSnapshot['compromisosPendientes']['items'] {
    const expenses = txs.filter((t) => t.type === 'expense')
    const now = new Date()
    const weekOfMonth = Math.ceil(now.getUTCDate() / 7)
    const items: NinaSnapshot['compromisosPendientes']['items'] = []
    const byKey = new Map<string, FinanceTransaction[]>()

    for (const t of expenses) {
      const d = new Date(t.date + 'T12:00:00Z')
      const monthsAgo =
        (now.getUTCFullYear() - d.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - d.getUTCMonth())
      if (monthsAgo < 1 || monthsAgo > 3) continue
      const w = Math.ceil(d.getUTCDate() / 7)
      if (w !== weekOfMonth) continue
      const key = `${(t.category || '').toLowerCase()}:${Math.round(t.amount)}`
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(t)
    }

    const monthStart = this.currentMonthStart()
    for (const [key, list] of byKey) {
      if (list.length < 2) continue
      const [cat] = key.split(':')
      const avg =
        list.reduce((s, t) => s + t.amount, 0) / list.length
      const paidThisMonth = expenses.some(
        (t) =>
          t.date >= monthStart &&
          (t.category || '').toLowerCase() === cat &&
          Math.abs(t.amount - avg) / avg <= 0.1,
      )
      if (!paidThisMonth) {
        const due = this.addDaysUtc(this.todayUtc(), 7)
        items.push({
          nombre: cat,
          monto: Math.round(avg * 100) / 100,
          fechaVencimiento: due,
          fuente: 'recurrente_detectado',
        })
      }
    }
    return items
  }

  private scoreFactors123(
    txs: FinanceTransaction[],
    goals: FinanceGoal[],
  ): { f1: number; f2: number; f3: number } {
    const flujo = this.flujoCajaLibre(txs, [])
    const ratio = flujo.ratioAhorro

    let f1 = 0
    if (ratio >= 0.2) f1 = 30
    else if (ratio >= 0.15) f1 = 25
    else if (ratio >= 0.1) f1 = 18
    else if (ratio >= 0.05) f1 = 10

    const monthlyTotals = this.lastNMonthsUtc(3).map((r) =>
      txs
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.date >= r.start &&
            t.date <= r.end,
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    const mu =
      monthlyTotals.reduce((a, b) => a + b, 0) / (monthlyTotals.length || 1)
    const variance =
      monthlyTotals.reduce((s, x) => s + (x - mu) ** 2, 0) /
      (monthlyTotals.length || 1)
    const std = Math.sqrt(variance)
    const cv = mu > 0 ? std / mu : 1

    let f2 = 0
    if (cv < 0.1) f2 = 25
    else if (cv < 0.2) f2 = 20
    else if (cv < 0.3) f2 = 14
    else if (cv < 0.5) f2 = 7

    const activeGoals = goals.filter(
      (g) => g.status === 'active' || !g.status,
    )
    let f3 = 12
    if (activeGoals.length > 0) {
      const avgProgress =
        activeGoals.reduce((s, g) => {
          const target = Number(g.target_amount) || 1
          const current = Number(g.current_amount) || 0
          return s + Math.min(1, current / target)
        }, 0) / activeGoals.length
      f3 = Math.round(avgProgress * 25)
    }

    return { f1, f2, f3 }
  }

  private historicalCoreScores(
    txs: FinanceTransaction[],
    goals: FinanceGoal[],
  ): number[] {
    const scores: number[] = []
    for (let i = 1; i <= 3; i++) {
      const range = this.monthRangeUtc(i)
      const monthTxs = txs.filter(
        (t) => t.date >= range.start && t.date <= range.end,
      )
      if (monthTxs.length === 0) continue
      const { f1, f2, f3 } = this.scoreFactors123(monthTxs, goals)
      scores.push(f1 + f2 + f3)
    }
    return scores
  }

  private avgDailyExpense7d(expenses: FinanceTransaction[]): number {
    const last7 = this.lastNDaysUtc(7)
    const sum = expenses
      .filter((t) => last7.includes(t.date))
      .reduce((s, t) => s + t.amount, 0)
    return sum / 7
  }

  private async loadTransactions(
    userId: string,
  ): Promise<FinanceTransaction[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('transactions')
      .select('id, user_id, type, amount, description, category, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
    if (error) {
      this.logger.warn(`loadTransactions: ${error.message}`)
      return []
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      type: r.type as FinanceTransaction['type'],
      amount: Number(r.amount),
      description: (r.description as string) ?? null,
      category: (r.category as string) ?? 'other',
      date: (r.date as string).slice(0, 10),
    }))
  }

  private async loadSubscriptions(
    userId: string,
  ): Promise<FinanceSubscription[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('subscriptions')
      .select('id, user_id, name, amount, is_active, next_billing_date, category')
      .eq('user_id', userId)
    if (error) {
      this.logger.warn(`loadSubscriptions: ${error.message}`)
      return []
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      name: (r.name as string) ?? 'Suscripción',
      amount: Number(r.amount ?? 0),
      is_active: r.is_active !== false,
      next_billing_date: r.next_billing_date as string | null,
      category: r.category as string | null,
    }))
  }

  private async loadGoals(userId: string): Promise<FinanceGoal[]> {
    if (!this.db) return []
    const { data, error } = await this.db
      .from('goals')
      .select('id, user_id, name, target_amount, current_amount, status')
      .eq('user_id', userId)
    if (error) {
      this.logger.warn(`loadGoals: ${error.message}`)
      return []
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      name: r.name as string,
      target_amount: Number(r.target_amount),
      current_amount: Number(r.current_amount ?? 0),
      status: (r.status as string) ?? 'active',
    }))
  }

  private todayUtc(): string {
    const n = new Date()
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`
  }

  private addDaysUtc(iso: string, delta: number): string {
    const d = new Date(iso + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  private lastNDaysUtc(n: number): string[] {
    const today = this.todayUtc()
    return Array.from({ length: n }, (_, i) => this.addDaysUtc(today, -i))
  }

  private daysRemainingInMonth(): number {
    const n = new Date()
    const last = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0))
    return Math.max(1, last.getUTCDate() - n.getUTCDate() + 1)
  }

  private currentMonthStart(): string {
    const n = new Date()
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-01`
  }

  private lastNMonthsUtc(count: number): Array<{ start: string; end: string }> {
    const ranges: Array<{ start: string; end: string }> = []
    const n = new Date()
    for (let i = 0; i < count; i++) {
      const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - i, 1))
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth()
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(
        new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
      ).padStart(2, '0')}`
      ranges.push({ start, end })
    }
    return ranges
  }

  private monthRangeUtc(monthsAgo: number): { start: string; end: string } {
    const n = new Date()
    const d = new Date(
      Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - monthsAgo, 1),
    )
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    return {
      start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      end: `${y}-${String(m + 1).padStart(2, '0')}-${String(
        new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
      ).padStart(2, '0')}`,
    }
  }
}
