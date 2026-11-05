/**
 * DATA-02: reads bank statements from their text lines, deterministically (no LLM). One parser per
 * bank product, and every statement is checked against its own balances: the opening balance plus
 * what was read must give the balance the bank printed. If not, something was missed and Nina says so.
 */
import { categoryForRow, parseCsvAmount, type CsvRow, type CsvSkipReason } from './csv-import'
import { isoDate } from './period'
import type { CategoryRule } from './categories'

export type StatementLine = { text: string; cells?: Array<{ x: number; text: string }> }

export type StatementSkipReason = CsvSkipReason | 'card_payment' | 'unknown_operation' | 'refunded'

export type StatementReconciliation = { ok: boolean; expected: number; stated: number; difference: number }

export type StatementResult = {
  product: string
  period: { from: string; to: string } | null
  rows: CsvRow[]
  skipped: Array<{ line: number; reason: StatementSkipReason }>
  /** Null when the statement does not print the balances needed to check it. */
  reconciliation: StatementReconciliation | null
}

const round = (n: number) => Math.round(n * 100) / 100

export function reconcile(opening: number | null, net: number, closing: number | null): StatementReconciliation | null {
  if (opening === null || closing === null) return null
  const expected = round(opening + net)
  const difference = round(closing - expected)
  return { ok: Math.abs(difference) < 0.01, expected, stated: closing, difference }
}

const MONTHS: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11 }

/** The statement prints no year on rows: it is the one that keeps the day within the cycle's close. */
function dayInCycle(day: string, month: string, closing: Date): string | null {
  const m = MONTHS[month.toLowerCase()]
  const d = Number(day)
  if (m === undefined) return null
  let year = closing.getUTCFullYear()
  if (new Date(Date.UTC(year, m, d)) > closing) year -= 1
  const date = new Date(Date.UTC(year, m, d))
  return date.getUTCMonth() === m && date.getUTCDate() === d ? isoDate(date) : null
}

const parseShortDate = (raw: string): Date | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(raw)
  if (!m) return null
  const date = new Date(Date.UTC(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  return date.getUTCDate() === Number(m[1]) ? date : null
}

const CYCLE = /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})/
const OPENING = /SALDO ANTERIOR\s+([\d,]+\.\d{2})(-?)/i
const ROW = /^(\d{2})([A-Za-z]{3})\s+(\d{2})([A-Za-z]{3})\s+(.+?)\s+([A-Z]{4,})\s+([\d,]+\.\d{2})(-?)\s*$/
const DEBT_LIKE = /interes|comision|membresia|seguro|desgravamen|mora|penalidad/i
/** Page 2 lists the cycle's charges with no dates: "INTERESES  15.79". */
const CHARGE = /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,*/()-]+?)\s{2,}([\d,]+\.\d{2})(-?)$/
const NOT_A_CHARGE = /^(sub ?total|total|monto total|saldo)/i
/** Where the cycle's movements end: the bank's own total, then the informative installment plan. */
const MOVEMENTS_END = /^(monto total facturado|detalle plan cuotas)/i

/** "MONTO TOTAL FACTURADO" when printed; otherwise "Pago total S/", which sits above its value. */
function closingBalance(lines: StatementLine[]): number | null {
  const billed = lines.find((l) => /^monto total facturado/i.test(l.text.trim()))
  const billedAmount = billed?.text.match(/\d[\d,]*\.\d{2}/g)
  if (billedAmount?.length) return parseCsvAmount(billedAmount[billedAmount.length - 1])
  const at = lines.findIndex((l) => /pago total s\//i.test(l.text))
  if (at < 0) return null
  for (const l of lines.slice(at + 1, at + 4)) {
    const amounts = l.text.match(/\d[\d,]*\.\d{2}/g)
    if (amounts?.length) return parseCsvAmount(amounts[amounts.length - 1])
  }
  return null
}

/**
 * Amounts starting at the "Dólares" header are in dollars. Only that header is used: PDF readers
 * glue neighbouring columns ("Tipo de OperaciónSoles"), so "Soles" may not stand alone. If a dollar
 * row slips through anyway, the balance check stops matching and Nina warns.
 */
const DOLLARS_MARGIN = 10
function dollarsFromX(lines: StatementLine[]): number | null {
  for (const l of lines) {
    const dollars = l.cells?.find((c) => /^d[oó]lares$/i.test(c.text.trim()))
    if (dollars) return dollars.x - DOLLARS_MARGIN
  }
  return null
}

// The real header spreads "Tipo de / Operación" over two lines, so it is not used to recognize the statement.
const isBcpCard = (lines: StatementLine[]) =>
  lines.some((l) => /estado de cuenta tarjeta/i.test(l.text)) && lines.some((l) => OPENING.test(l.text))

/**
 * A charge the bank refunded in the same statement ("COMISION ANUAL POR MEMBRESIA" 170.00 and
 * "DEVOLUCION MEMBRESIA" 170.00-) cancels out: importing both would show a refund as income.
 */
function cancelRefunds(rows: CsvRow[], skipped: StatementResult['skipped']): CsvRow[] {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-záéíóúñ]+/).filter((w) => w.length >= 5 && w !== 'devolucion'))
  const gone = new Set<number>()
  for (const refund of rows.filter((r) => r.type === 'income')) {
    const key = words(refund.description)
    const charge = rows.find(
      (r) => r.type === 'expense' && !gone.has(r.line) && r.amount === refund.amount && [...words(r.description)].some((w) => key.has(w)),
    )
    if (!charge) continue
    gone.add(charge.line)
    gone.add(refund.line)
  }
  for (const line of [...gone].sort((a, b) => a - b)) skipped.push({ line, reason: 'refunded' })
  return rows.filter((r) => !gone.has(r.line))
}

function parseBcpCard(lines: StatementLine[], today: Date, rules: CategoryRule[]): StatementResult {
  const cycleAt = lines.findIndex((l) => CYCLE.test(l.text))
  const cycle = cycleAt >= 0 ? CYCLE.exec(lines[cycleAt].text) : null
  const from = cycle ? parseShortDate(cycle[1]) : null
  const to = cycle ? parseShortDate(cycle[2]) : null
  const closesOn = to ?? today
  const dollarsX = dollarsFromX(lines)

  let opening: number | null = null
  let net = 0
  let ended = false
  const rows: CsvRow[] = []
  const skipped: StatementResult['skipped'] = []
  const cycleDay = isoDate(closesOn)

  lines.forEach((l, index) => {
    const line = index + 1
    const text = l.text.trim()
    if (ended || MOVEMENTS_END.test(text)) {
      ended = true
      return
    }
    const open = OPENING.exec(text)
    if (open && opening === null) {
      const n = parseCsvAmount(open[1])
      opening = n === null ? null : open[2] ? -n : n
      return
    }
    if (opening === null) return
    const m = ROW.exec(text)
    if (!m) {
      const charge = CHARGE.exec(text)
      if (!charge || NOT_A_CHARGE.test(charge[1])) return
      const amount = parseCsvAmount(charge[2])
      if (amount === null) return
      const last = l.cells?.[l.cells.length - 1]
      if (dollarsX !== null && last && last.x >= dollarsX) return skipped.push({ line, reason: 'usd' }) && undefined
      net += charge[3] ? -amount : amount
      if (charge[3]) return skipped.push({ line, reason: 'unknown_operation' }) && undefined
      const description = charge[1].replace(/\s+/g, ' ').trim().slice(0, 140)
      rows.push({ line, date: cycleDay, description, amount, type: 'expense', category: DEBT_LIKE.test(description) ? 'debt' : categoryForRow(description, 'expense', rules) })
      return
    }
    const [, , , day, month, rest, operation, rawAmount, minus] = m
    const amount = parseCsvAmount(rawAmount)
    const date = dayInCycle(day, month, closesOn)
    if (amount === null) return skipped.push({ line, reason: 'bad_amount' }) && undefined
    const last = l.cells?.[l.cells.length - 1]
    if (dollarsX !== null && last && last.x >= dollarsX) return skipped.push({ line, reason: 'usd' }) && undefined
    net += minus ? -amount : amount
    if (operation === 'PAGO') return skipped.push({ line, reason: 'card_payment' }) && undefined
    if (!date) return skipped.push({ line, reason: 'bad_date' }) && undefined
    const description = rest.split(/\s{2,}/)[0].trim().slice(0, 140)
    if (minus && operation !== 'DEVOLUCION') return skipped.push({ line, reason: 'unknown_operation' }) && undefined
    const type = minus ? 'income' : 'expense'
    const category =
      operation === 'PAGOSERVIC' ? 'services' : DEBT_LIKE.test(`${description} ${operation}`) ? 'debt' : categoryForRow(description, type, rules)
    rows.push({ line, date, description, amount, type, category })
  })

  return {
    product: 'Tarjeta BCP',
    period: from && to ? { from: isoDate(from), to: isoDate(to) } : null,
    rows: cancelRefunds(rows, skipped),
    skipped,
    reconciliation: reconcile(opening, net, closingBalance(lines)),
  }
}

/** Null when no parser recognizes the statement. */
export function parseStatement(
  lines: StatementLine[],
  opts: { today: Date; rules?: CategoryRule[] },
): StatementResult | null {
  if (isBcpCard(lines)) return parseBcpCard(lines, opts.today, opts.rules ?? [])
  return null
}
