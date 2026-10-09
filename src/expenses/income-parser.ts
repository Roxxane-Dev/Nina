/**
 * income-parser.ts
 *
 * Deterministic, regex-only income extraction from Spanish natural-language.
 * Mirrors the pattern of expense-parser.ts.
 */

export type ParsedIncome = {
  amount: number
  /** Normalized category: 'salary' | 'freelance' | 'transfer' | 'other' */
  category: string
  /** Raw description from the user message */
  description: string
}

// ─── Intent patterns ──────────────────────────────────────────────────────────

/**
 * Verbs / phrases that indicate an income event.
 * Accent-stripped lowercase so 'gané' → 'gane' matches.
 */
const INCOME_INTENT_REGEX =
  /\b(?:gane|ganar|me\s+pagaron|me\s+pagan|pagar|recibi|recibir|cobr[eé]|cobrar|ingresos?|sueldos?|salarios?|abonos?|depositos?|depositar|me\s+depositaron|vendi|vender|factur[eé]|facturar|me\s+llego|registrar)\b/i

/**
 * Captures the numeric amount, prioritizing numbers with currency symbols/words
 * or ensuring it's not just a standalone year like "2027".
 */
function extractAmount(text: string): number | null {
  // 1. Try to find number near a currency indicator
  const currencyRegex = /(?:s\/|soles|usd|\$|dolares|pesos)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:s\/|soles|usd|\$|dolares|pesos)/i
  const currMatch = text.match(currencyRegex)
  if (currMatch) {
    return parseMoneyToken(currMatch[1] || currMatch[2])
  }

  // 2. Fallback to any number, but ignore obvious years like 202X
  const allNumbers = [...text.matchAll(/(\d+(?:[.,]\d+)?)/g)]
  for (const match of allNumbers) {
    const val = parseMoneyToken(match[1])
    if (val && (val < 2000 || val > 2100 || match[1].includes('.') || match[1].includes(','))) {
      return val
    }
  }
  // If only a year-like number exists, return it as last resort
  if (allNumbers.length > 0) {
    return parseMoneyToken(allNumbers[0][1])
  }
  return null;
}

// ─── Category inference ───────────────────────────────────────────────────────

function inferCategory(text: string): string {
  const t = text.toLowerCase()
  if (/sueldo|salario|nomina|quincena/.test(t)) return 'salary'
  if (/freelance|proyecto|cliente|factura|honorar/.test(t)) return 'freelance'
  if (/transfer|deposito|abono/.test(t)) return 'transfer'
  return 'other'
}

// ─── Money token parser (same as expense-parser) ─────────────────────────────

function parseMoneyToken(token: string): number | null {
  const t = token.trim()
  if (!t) return null
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(t))
    return parseFloat(t.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(\.\d{3})+$/.test(t))
    return parseInt(t.replace(/\./g, ''), 10)
  if (/^\d+[.,]\d{1,2}$/.test(t))
    return parseFloat(t.replace(',', '.'))
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

// ─── Core extractor ──────────────────────────────────────────────────────────

/**
 * Extracts a single income event from a natural-language message.
 * Returns null if no income intent is found.
 *
 * Unlike expenses (multiple items per message), an income message
 * typically describes one event, so we return the first match.
 */
export function parseIncome(message: string): ParsedIncome | null {
  const text = message.trim()
  if (text.length < 3 || text.length > 2000) return null

  const stripped = stripAccents(text).toLowerCase()

  if (!INCOME_INTENT_REGEX.test(stripped)) return null

  const amount = extractAmount(stripped)
  if (!amount || amount <= 0 || amount >= 1e9) return null

  return {
    amount,
    category: inferCategory(stripped),
    description: text,
  }
}
