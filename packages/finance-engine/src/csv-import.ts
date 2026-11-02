/**
 * DATA-01: reads a bank CSV deterministically (no LLM). Peruvian exports vary a lot: `;` or `,`,
 * a few lines of title before the header, `1.234,56` or `1,234.56`, one amount column or separate
 * cargo / abono columns. Rows that cannot be trusted are skipped with a reason, never guessed.
 */
import { detectCategoryInText, matchCategoryRule, type CategoryRule } from './categories'
import { isoDate } from './period'

export const CSV_MAX_ROWS = 2000
export const CSV_MAX_CHARS = 1_000_000
const HEADER_SEARCH_LINES = 15
const MAX_DESCRIPTION = 140

export type CsvSkipReason = 'bad_date' | 'future_date' | 'bad_amount' | 'zero_amount' | 'usd' | 'too_many_rows'

export type CsvRow = {
  /** Line in the file, 1-based: what the user sees, and how they exclude a row. */
  line: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
}

export type CsvParseResult =
  | { ok: true; rows: CsvRow[]; skipped: Array<{ line: number; reason: CsvSkipReason }>; assumedExpenses: boolean }
  | { ok: false; error: 'empty' | 'no_header' | 'too_large' }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()

const HEADERS = {
  date: ['fecha', 'fecha operacion', 'fecha de operacion', 'fecha movimiento', 'f. operacion', 'fec. operacion', 'date', 'fecha proceso'],
  description: ['descripcion', 'descripcion operacion', 'glosa', 'concepto', 'detalle', 'movimiento', 'comercio', 'establecimiento', 'referencia', 'description'],
  amount: ['monto', 'importe', 'valor', 'amount', 'monto soles', 'importe soles'],
  debit: ['cargo', 'cargos', 'debe', 'debito', 'retiro', 'retiros', 'salidas'],
  credit: ['abono', 'abonos', 'haber', 'credito', 'deposito', 'depositos', 'entradas'],
  currency: ['moneda', 'divisa', 'currency'],
}

/** RFC-4180 style: quotes may hold delimiters, line breaks and doubled quotes. */
function parseRecords(text: string, delimiter: string): Array<{ line: number; cells: string[] }> {
  const out: Array<{ line: number; cells: string[] }> = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let start = 1
  const flush = () => {
    cells.push(cell)
    cell = ''
    if (cells.some((c) => c.trim())) out.push({ line: start, cells })
    cells = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else {
        if (ch === '\n') line++
        cell += ch
      }
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      cells.push(cell)
      cell = ''
    } else if (ch === '\n') {
      flush()
      line++
      start = line
    } else if (ch !== '\r') cell += ch
  }
  flush()
  return out
}

function detectDelimiter(text: string): string {
  const sample = text.split('\n').slice(0, HEADER_SEARCH_LINES).join('\n')
  let best = ','
  let bestCount = -1
  for (const d of [';', '\t', '|', ',']) {
    const count = sample.split(d).length - 1
    if (count > bestCount) {
      best = d
      bestCount = count
    }
  }
  return best
}

const column = (header: string[], names: string[]) => {
  for (const n of names) {
    const i = header.indexOf(n)
    if (i >= 0) return i
  }
  return -1
}

/** "S/ 1,234.56", "1.234,56", "(50.00)", "50.00-" → number; null when it is not an amount. */
export function parseCsvAmount(raw: string): number | null {
  let s = raw.replace(/s\/\.?|soles|pen/gi, '').replace(/\s/g, '')
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    negative = true
    s = s.slice(0, -1)
  }
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)
  if (!/^\d[\d.,]*$/.test(s)) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const last = Math.max(lastDot, lastComma)
  const decimals = last >= 0 ? s.length - last - 1 : 0
  // A lone separator with three digits after it is thousands: money has two decimals.
  const onlyOneKind = lastDot < 0 || lastComma < 0
  const isThousands = last >= 0 && onlyOneKind && decimals === 3
  const whole = (isThousands || last < 0 ? s : s.slice(0, last)).replace(/[.,]/g, '')
  const fraction = isThousands || last < 0 ? '' : s.slice(last + 1)
  const n = Number(`${whole}.${fraction || '0'}`)
  if (!Number.isFinite(n)) return null
  return Math.round((negative ? -n : n) * 100) / 100
}

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd/mm/yy or yyyy-mm-dd → 'YYYY-MM-DD'; null when invalid. */
export function parseCsvDate(raw: string): string | null {
  const s = raw.trim().split(/[ T]/)[0]
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s)
  const peru = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s)
  let y: number, m: number, d: number
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else if (peru) {
    ;[d, m, y] = [Number(peru[1]), Number(peru[2]), Number(peru[3])]
    if (y < 100) y += 2000
  } else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return isoDate(date)
}

const SALARY = /\b(sueldo|haberes|remuneracion|planilla|quincena|nomina)\b/

function categoryFor(description: string, type: CsvRow['type'], rules: CategoryRule[]): string {
  const remembered = matchCategoryRule(description, rules)
  if (remembered) return remembered
  if (type === 'income') return SALARY.test(fold(description)) ? 'salary' : 'other'
  return detectCategoryInText(description) ?? 'other'
}

export function parseCsvStatement(input: string, opts: { today: Date; rules?: CategoryRule[] }): CsvParseResult {
  if (input.length > CSV_MAX_CHARS) return { ok: false, error: 'too_large' }
  const text = input.replace(/^﻿/, '')
  if (!text.trim()) return { ok: false, error: 'empty' }

  const records = parseRecords(text, detectDelimiter(text))
  const headerAt = records.slice(0, HEADER_SEARCH_LINES).findIndex((r) => {
    const h = r.cells.map(fold)
    const hasMoney = column(h, HEADERS.amount) >= 0 || column(h, HEADERS.debit) >= 0 || column(h, HEADERS.credit) >= 0
    return column(h, HEADERS.date) >= 0 && hasMoney
  })
  if (headerAt < 0) return { ok: false, error: 'no_header' }

  const header = records[headerAt].cells.map(fold)
  const col = {
    date: column(header, HEADERS.date),
    description: column(header, HEADERS.description),
    amount: column(header, HEADERS.amount),
    debit: column(header, HEADERS.debit),
    credit: column(header, HEADERS.credit),
    currency: column(header, HEADERS.currency),
  }
  const todayIso = isoDate(opts.today)
  const rules = opts.rules ?? []
  const data = records.slice(headerAt + 1)
  const separated = col.debit >= 0 || col.credit >= 0

  // One amount column with no sign anywhere: banks list card charges like this.
  const assumedExpenses =
    !separated &&
    data.length > 0 &&
    data.every((r) => {
      const n = parseCsvAmount(r.cells[col.amount] ?? '')
      return n === null || n >= 0
    })

  const rows: CsvRow[] = []
  const skipped: Array<{ line: number; reason: CsvSkipReason }> = []
  for (const { line, cells } of data) {
    if (rows.length >= CSV_MAX_ROWS) {
      skipped.push({ line, reason: 'too_many_rows' })
      continue
    }
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    const date = parseCsvDate(cell(col.date))
    const rawMoney = separated ? `${cell(col.debit)}${cell(col.credit)}` : cell(col.amount)
    // Footers such as "Saldo final" carry neither a date nor an amount.
    if (!date && !parseCsvAmount(rawMoney)) continue
    if (/\b(usd|us\$|dolares)\b/i.test(fold(cell(col.currency))) || cell(col.currency) === '$' || /\$/.test(rawMoney)) {
      skipped.push({ line, reason: 'usd' })
      continue
    }
    if (!date) {
      skipped.push({ line, reason: 'bad_date' })
      continue
    }
    if (date > todayIso) {
      skipped.push({ line, reason: 'future_date' })
      continue
    }
    let signed: number | null
    if (separated) {
      const debit = parseCsvAmount(cell(col.debit))
      const credit = parseCsvAmount(cell(col.credit))
      signed = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : debit === null && credit === null ? null : 0
    } else {
      const n = parseCsvAmount(cell(col.amount))
      signed = n === null ? null : assumedExpenses ? -Math.abs(n) : n
    }
    if (signed === null) {
      skipped.push({ line, reason: 'bad_amount' })
      continue
    }
    if (signed === 0) {
      skipped.push({ line, reason: 'zero_amount' })
      continue
    }
    const type = signed > 0 ? 'income' : 'expense'
    const description = cell(col.description).replace(/\s+/g, ' ').slice(0, MAX_DESCRIPTION)
    rows.push({ line, date, description, amount: Math.abs(signed), type, category: categoryFor(description, type, rules) })
  }
  return { ok: true, rows, skipped, assumedExpenses }
}

/** Same day, amount, type and description. Counted, because two equal coffees in a day are real. */
const movementKey = (m: { date: string; amount: number; type: string; description: string | null }) =>
  `${m.date}|${m.amount.toFixed(2)}|${m.type}|${fold(m.description ?? '')}`

/** Lines already registered, so uploading the same file twice adds nothing. */
export function duplicateLines(
  rows: CsvRow[],
  existing: Array<{ date: string; amount: number; type: string; description: string | null }>,
): Set<number> {
  const left = new Map<string, number>()
  for (const e of existing) left.set(movementKey(e), (left.get(movementKey(e)) ?? 0) + 1)
  const out = new Set<number>()
  for (const r of rows) {
    const key = movementKey(r)
    const n = left.get(key) ?? 0
    if (n > 0) {
      out.add(r.line)
      left.set(key, n - 1)
    }
  }
  return out
}
