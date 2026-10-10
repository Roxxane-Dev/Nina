/** es-PE money format used in every user-facing text: "S/ 1,250.50". */
export function formatSoles(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}S/ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
