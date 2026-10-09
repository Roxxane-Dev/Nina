const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'CARD', re: /\b\d{13,19}\b/g },
  { name: 'ACCOUNT', re: /\b\d{10,20}\b/g },
  { name: 'EMAIL', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { name: 'PHONE', re: /\b(?:\+51)?\s?9\d{8}\b/g },
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
