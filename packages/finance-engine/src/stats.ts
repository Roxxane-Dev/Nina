export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  if (lo === hi) return s[lo]
  return s[lo] * (hi - i) + s[hi] * (i - lo)
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
