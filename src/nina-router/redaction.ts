// Order matters: the most specific / longest identifiers go first.
const PATTERNS: Array<{ name: string; re: RegExp }> = [
  // CCI: 20 digits, plain or grouped 3-3-12-2 with spaces or hyphens.
  { name: 'CCI', re: /\b\d{3}[ -]?\d{3}[ -]?\d{12}[ -]?\d{2}\b/g },
  // Cards: 13-19 digits, plain or grouped 4-4-4-x / Amex 4-6-5.
  { name: 'CARD', re: /\b(?:\d{4}[ -]){3}\d{1,4}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b|\b\d{13,19}\b/g },
  // RUC: 11 digits starting with 10, 15, 16, 17 or 20.
  { name: 'RUC', re: /\b(?:10|15|16|17|20)\d{9}\b/g },
  // Mobile: 9XX XXX XXX, optional +51 prefix, spaces or hyphens.
  { name: 'PHONE', re: /(?:\+\s?51[\s-]?|\b)9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g },
  { name: 'ACCOUNT', re: /\b\d{10,20}\b/g },
  { name: 'EMAIL', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { name: 'DNI', re: /\b\d{8}\b/g },
]

export type RedactionMap = Record<string, string>

export function redactPii(text: string): { text: string; map: RedactionMap } {
  let out = text
  const map: RedactionMap = {}
  let i = 1
  for (const p of PATTERNS) {
    out = out.replace(p.re, (m) => {
      const token = `<${p.name}_${i++}>`
      map[token] = m
      return token
    })
  }
  return { text: out, map }
}

export function wrapUntrusted(text: string): string {
  const { text: redacted } = redactPii(text)
  return `<untrusted>${redacted}</untrusted>`
}

export function restoreTokens(text: string, map: RedactionMap): string {
  let out = text
  for (const [token, value] of Object.entries(map)) {
    out = out.split(token).join(value)
  }
  return out
}
