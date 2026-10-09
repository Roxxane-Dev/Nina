import type { Memory } from './ai.types'

/** Character budget for injected memory text (after count limits). */
export const MEMORY_CHAR_BUDGET = {
  free: 2_000,
  premium: 8_000,
} as const

/**
 * Higher score first; items without a score sort last so explicit scores win.
 */
export function sortMemoriesByRelevance(memories: Memory[]): Memory[] {
  return [...memories].sort(
    (a, b) => (b.relevanceScore ?? -Infinity) - (a.relevanceScore ?? -Infinity),
  )
}

/**
 * Combine caller-supplied memories with retrieved ones; dedupes by content.
 */
export function mergeMemories(a: Memory[], b: Memory[]): Memory[] {
  return dedupeMemories([...a, ...b])
}

/**
 * Dedupe by normalized content while preserving first occurrence (usually higher relevance).
 */

export function dedupeMemories(memories: Memory[]): Memory[] {
  const seen = new Set<string>()
  const out: Memory[] = []
  for (const m of memories) {
    const key = m.content.trim().toLowerCase()
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(m)
  }
  return out
}

/**
 * Greedy pack by relevance order until `maxChars` total content is reached.
 * Truncates the last memory if needed to stay within budget.
 */
export function truncateMemories(memories: Memory[], maxChars: number): Memory[] {
  if (maxChars <= 0) {
    return []
  }
  const sorted = sortMemoriesByRelevance(memories)
  const out: Memory[] = []
  let used = 0
  for (const m of sorted) {
    const remaining = maxChars - used
    if (remaining <= 0) {
      break
    }
    if (m.content.length <= remaining) {
      out.push(m)
      used += m.content.length
    } else {
      out.push({
        ...m,
        content: m.content.slice(0, remaining),
      })
      break
    }
  }
  return out
}

/**
 * Plan caps: free → top 3, premium → top 10 (by relevance order).
 */
export function limitMemoriesByPlan(memories: Memory[], plan: 'free' | 'premium' | undefined): Memory[] {
  const cap = plan === 'premium' ? 10 : 3
  return sortMemoriesByRelevance(memories).slice(0, cap)
}
