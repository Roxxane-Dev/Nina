import { median, stdev } from './stats'
import { daysBetween } from './period'
import { SUBSCRIPTION_SLUGS, type DetectedRecurring, type EngineTransaction } from './types'

function classifyInterval(days: number): DetectedRecurring['frequency'] | null {
  if (Math.abs(days - 7) <= 2) return 'weekly'
  if (Math.abs(days - 14) <= 3) return 'biweekly'
  if (Math.abs(days - 30) <= 4) return 'monthly'
  if (Math.abs(days - 365) <= 10) return 'annual'
  return null
}

export function detectRecurrence(txs: EngineTransaction[], asOf: Date): DetectedRecurring[] {
  const groups = new Map<string, EngineTransaction[]>()
  for (const t of txs.filter((t) => !t.isTransfer && t.amount < 0)) {
    const key = t.merchantNormalized || t.categorySlug
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(t)
    groups.set(key, list)
  }

  const out: DetectedRecurring[] = []
  for (const [merchant, list] of groups) {
    const sorted = [...list].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime())
    const amounts = sorted.map((t) => -t.amount)
    const medAmt = median(amounts)
    const clustered = sorted.filter((t) => {
      const a = -t.amount
      return medAmt === 0 ? a === 0 : Math.abs(a - medAmt) / medAmt <= 0.1
    })
    if (clustered.length < 2) continue
    const intervals: number[] = []
    for (let i = 1; i < clustered.length; i++) {
      intervals.push(daysBetween(clustered[i - 1].postedAt, clustered[i].postedAt))
    }
    const medInt = median(intervals)
    const freq = classifyInterval(medInt)
    if (!freq) continue
    const minOcc = freq === 'annual' ? 2 : 3
    if (clustered.length < minOcc) continue
    const lastSeen = clustered[clustered.length - 1].postedAt
    const next = new Date(lastSeen.getTime() + medInt * 86_400_000)
    const amtCv = medAmt === 0 ? 0 : stdev(clustered.map((t) => -t.amount)) / medAmt
    const intCv = medInt === 0 ? 1 : stdev(intervals) / medInt
    const confidence = Math.max(
      0.3,
      Math.min(0.99, 0.4 + clustered.length * 0.08 - amtCv * 0.2 - intCv * 0.2),
    )
    const slug = clustered[0].categorySlug
    out.push({
      merchantNormalized: merchant,
      typicalAmount: medAmt,
      frequency: freq,
      nextExpected: next < asOf ? new Date(asOf.getTime() + medInt * 86_400_000) : next,
      lastSeen,
      confidence,
      occurrences: clustered.length,
      isSubscription: SUBSCRIPTION_SLUGS.has(slug),
    })
  }
  return out
}
