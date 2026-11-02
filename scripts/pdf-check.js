// Checks a real statement PDF on your own machine. Nothing leaves it: no network, no database.
// Prints counts and the balance check; names, merchants and amounts never appear.
//
//   npm run build
//   node scripts/pdf-check.js "C:/ruta/mi-eecc.pdf"
//
// If the PDF has a password, set it for that one command:
//   PDF_PASSWORD=xxxx node scripts/pdf-check.js "C:/ruta/mi-eecc.pdf"
// Lines the parser did not use go to .local-logs/pdf-check.txt with every letter and digit hidden
// except a short list of column words, so that file can be reviewed and shared.
const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'dist')
const { extractPdfLines } = require(path.join(dist, 'src/statements/pdf-text.js'))
const { parseStatement } = require(path.join(dist, 'packages/finance-engine/src/index.js'))

const KEEP = /^(saldo|anterior|pago|pagos|total|consumo|pagoservic|devolucion|intereses?|comisi[oó]n(es)?|membres[ií]a|cuota|cuotas|cargo|abono|soles|d[oó]lares|fecha|tipo|operaci[oó]n|descripci[oó]n|proceso|ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)$/i
const mask = (line) =>
  line
    .split(/(\s+)/)
    .map((w) => (KEEP.test(w) ? w : w.replace(/\p{L}/gu, 'x').replace(/\d/g, '9')))
    .join('')

;(async () => {
  const file = process.argv[2]
  if (!file) throw new Error('Falta la ruta del PDF.')
  const bytes = new Uint8Array(fs.readFileSync(file))
  const text = await extractPdfLines(bytes, process.env.PDF_PASSWORD || undefined)
  if (!text.ok) {
    console.log('No se pudo leer:', text.error)
    return
  }
  console.log('Páginas:', text.pages, '· líneas de texto:', text.lines.length)
  const result = parseStatement(text.lines, { today: new Date() })
  if (!result) {
    console.log('Ningún lector reconoce este documento.')
  } else {
    const count = {}
    for (const s of result.skipped) count[s.reason] = (count[s.reason] ?? 0) + 1
    console.log('Producto:', result.product, '· periodo:', result.period ? 'leído' : 'NO leído')
    console.log('Movimientos:', result.rows.length, '· saltados:', JSON.stringify(count))
    console.log('Cuadre:', result.reconciliation ? (result.reconciliation.ok ? 'OK' : `NO cuadra, diferencia ${result.reconciliation.difference}`) : 'sin saldos')
  }
  const used = new Set([...(result?.rows ?? []), ...(result?.skipped ?? [])].map((r) => r.line))
  const unused = text.lines.map((l, i) => (used.has(i + 1) ? null : `${i + 1}: ${mask(l.text)}`)).filter(Boolean)
  const out = path.join(__dirname, '..', '.local-logs', 'pdf-check.txt')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, unused.join('\n') + '\n')
  console.log('Líneas sin usar, enmascaradas, en:', out)
})().catch((e) => {
  console.log('Error:', e.name)
  process.exitCode = 1
})
