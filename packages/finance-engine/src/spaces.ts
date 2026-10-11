/**
 * US-35: does a chat registration say it belongs to a shared space?
 * "es de la casa", "para la casa", "es compartido", "es de Casa" (space name).
 */
export type SpaceRef = { id: string; name: string }
export type SpaceMatch = { spaceId: string; name: string } | { ambiguous: true } | null

const GENERIC = /\b(compartid[oa]s?|gasto comun|de la casa|para la casa|del hogar|de la familia|para la familia|del depa|del espacio)\b/

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

export function detectSpaceReference(message: string, spaces: SpaceRef[]): SpaceMatch {
  if (!spaces.length) return null
  const text = ` ${fold(message).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ')} `
  // A space named in the message wins ("es de Casa", "para Familia Pérez").
  const named = spaces
    .filter((s) => {
      const n = fold(s.name).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()
      return n.length > 0 && text.includes(` ${n} `)
    })
    .sort((a, b) => b.name.length - a.name.length)
  if (named.length) return { spaceId: named[0].id, name: named[0].name }
  if (!GENERIC.test(text)) return null
  return spaces.length === 1 ? { spaceId: spaces[0].id, name: spaces[0].name } : { ambiguous: true }
}
