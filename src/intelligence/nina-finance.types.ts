export interface FinanceTransaction {
  id: string
  user_id: string
  type: 'income' | 'expense' | 'transfer' | 'subscription'
  amount: number
  description: string | null
  category: string
  date: string
}

export interface FinanceSubscription {
  id: string
  user_id: string
  name: string
  amount: number
  is_active: boolean
  next_billing_date?: string | null
  category?: string | null
}

export interface FinanceGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  status: string
}

export interface NinaSnapshot {
  saldoEstimado: {
    amount: number
    status: 'green' | 'yellow' | 'red'
    tooltip: string
  }
  pulsoDelDia: {
    gastoHoy: number
    promedioDiario7d: number
    deltaPct: number
    diasBajoPromedio: number
  }
  proyeccionCierreMes: {
    amount: number
    status: 'green' | 'yellow' | 'red'
    diasRestantes: number
  }
  compromisosPendientes: {
    total: number
    items: Array<{
      nombre: string
      monto: number
      fechaVencimiento: string
      fuente: 'subscription' | 'recurrente_detectado'
    }>
  }
  anomalias: Array<{
    transactionId: string
    categoria: string
    monto: number
    zScore: number
    multiplicador: number
    mediaCategoria: number
    descripcion: string
    fecha: string
  }>
  tendenciaCategorias: Record<
    string,
    {
      mesActual: number
      mesAnterior: number
      pctCambio: number
      direction: 'up' | 'down' | 'stable'
    }
  >
  gastosHormiga: {
    count: number
    total: number
    semanaActual: number
    comparacionConcreta: string
    items: FinanceTransaction[]
  }
  patrones: {
    diaMayorGasto: string
    categoriaMayorCrecimiento: { nombre: string; pctCambio: number }
    gastoHormigas: NinaSnapshot['gastosHormiga']
  }
  flujoCajaLibre: {
    amount: number
    isNegative: boolean
    ingresoPromedio3m: number
    gastosFijosRecurrentes: number
    promedioVariables3m: number
    ratioAhorro: number
    ratioAhorroPct: number
    mensajeNatural: string
  }
  scoreFinanciero: {
    total: number
    status: 'green' | 'orange' | 'red'
    factores: Array<{
      nombre: string
      puntos: number
      maxPuntos: number
      microAccion: string | null
    }>
    deltaMesAnterior: number
  }
  topCategoriasMes: Array<{ categoria: string; total: number; pct: number }>
  metasProgreso: Array<{ nombre: string; current: number; target: number; pct: number }>
}
