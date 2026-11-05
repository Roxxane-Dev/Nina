/** es-PE money format for text the engine writes itself: "S/ 1,250.50", "-S/ 20.00". */
export function solesText(n: number): string {
  return `${n < 0 ? '-' : ''}S/ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
