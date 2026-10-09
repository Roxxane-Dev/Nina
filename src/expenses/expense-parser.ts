/**
 * expense-parser.ts
 *
 * Deterministic, regex-only expense extraction.
 * Returns ALL items found in a message in original order.
 * Does NOT call the DB — category resolution is done by ExpensesService.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParsedExpense = {
  amount: number
  /** Normalised category key ('food', 'transport', …) resolved locally. */
  normalizedCategory: string
  /** Raw word(s) the user typed, e.g. "comida", "netflix". */
  rawCategory: string
  description: string
}

// ─── Category normaliser (local fallback — DB is authoritative) ───────────────

const CATEGORY_MAP: Record<string, string> = {
  // food
  comida: 'food', restaurante: 'food', restaurant: 'food',
  cafe: 'food', café: 'food', mercado: 'food', super: 'food',
  supermercado: 'food', desayuno: 'food', almuerzo: 'food',
  cena: 'food', pan: 'food', bebida: 'food', lunch: 'food',

  // transport
  transporte: 'transport', uber: 'transport', taxi: 'transport',
  gasolina: 'transport', metro: 'transport', bus: 'transport',
  peaje: 'transport', estacionamiento: 'transport', parking: 'transport',
  combustible: 'transport',

  // home / rent
  renta: 'home', alquiler: 'home', arriendo: 'home',
  departamento: 'home', depa: 'home', casa: 'home', hogar: 'home',

  // health
  salud: 'health', gym: 'health', gimnasio: 'health',
  farmacia: 'health', medicina: 'health', medico: 'health',

  // entertainment
  entretenimiento: 'entertainment', cine: 'entertainment',
  netflix: 'entertainment', spotify: 'entertainment',
  disney: 'entertainment', hbo: 'entertainment',
  juegos: 'entertainment', videojuegos: 'entertainment', fiesta: 'entertainment',

  // shopping
  ropa: 'shopping', zapatos: 'shopping', tienda: 'shopping',
  compras: 'shopping', amazon: 'shopping',
}

export function normalizeCategory(raw: string): string {
  const key = raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip accents for lookup
  return CATEGORY_MAP[key] ?? 'other'
}

// ─── Money token parser ───────────────────────────────────────────────────────

/**
 * Converts a Spanish/English numeric string to a JS number.
 *   "1.200"     → 1200   (thousands dot)
 *   "1.234,56"  → 1234.56
 *   "25,5"      → 25.5
 *   "25.5"      → 25.5
 *   "100"       → 100
 */
export function parseMoneyToken(token: string): number | null {
  const t = token.trim()
  if (!t) return null

  // Spanish full format: 1.234,56
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(t))
    return parseFloat(t.replace(/\./g, '').replace(',', '.'))

  // Thousands only: 1.200
  if (/^\d{1,3}(\.\d{3})+$/.test(t))
    return parseInt(t.replace(/\./g, ''), 10)

  // Decimal comma or dot: 25,5 / 25.5
  if (/^\d+[.,]\d{1,2}$/.test(t))
    return parseFloat(t.replace(',', '.'))

  // Plain integer
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }

  return null
}

// ─── Accent stripper ──────────────────────────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

// ─── Core multi-expense extractor ────────────────────────────────────────────

/**
 * Primary pattern — runs on accent-stripped lowercase text.
 * Captures (amount) then (category word) after optional prepositions.
 *
 * Uses matchAll — never regex.exec.
 */
const EXPENSE_REGEX =
  /(\d+(?:[.,]\d+)?)\s*(?:en|para|de|on|for)?\s+([a-z]+)/gi

const INTENT_REGEX =
  /\b(?:gaste|gastar|pague|pagar|compre|comprar|compra|gastos?|pagos?|inverti|invertir|me\s+costo?|cost[oó]|registre|registrar|registro)\b/i

/**
 * Parses ALL expense items from a natural-language message.
 *
 * Returns an empty array when:
 * - message contains no spend intent verb
 * - no (amount, category) pair can be extracted
 *
 * Order is always preserved (matches appear in sentence order).
 */
export function parseExpenses(message: string): ParsedExpense[] {
  const text = message.trim()
  if (text.length < 3 || text.length > 2000) return []

  // Normalise accents so 'gasté' → 'gaste', 'pagué' → 'pague', etc.
  const stripped = stripAccents(text).toLowerCase()

  // Must look like an expense message
  if (!INTENT_REGEX.test(stripped)) return []

  const results: ParsedExpense[] = []

  for (const match of stripped.matchAll(EXPENSE_REGEX)) {
    const amountRaw = match[1]
    const rawCategory = match[2]

    const amount = parseMoneyToken(amountRaw)
    if (amount === null || amount <= 0 || amount >= 1e9) continue

    const normalizedCategory = normalizeCategory(rawCategory)

    results.push({
      amount,
      normalizedCategory,
      rawCategory,
      description: text, // keep original user text as description
    })
  }

  return results
}

// ─── Backward-compat alias (used by ChatService) ─────────────────────────────

/** @deprecated Use parseExpenses() — this alias will be removed. */
export const parseExpense = parseExpenses
