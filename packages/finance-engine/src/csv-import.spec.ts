import { CSV_MAX_CHARS, CSV_MAX_ROWS, duplicateLines, parseCsvAmount, parseCsvDate, parseCsvStatement } from './csv-import'

const today = new Date('2026-11-01T00:00:00Z')
const parse = (csv: string, rules = [] as Array<{ pattern: string; category: string }>) => {
  const r = parseCsvStatement(csv, { today, rules })
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('parseCsvAmount', () => {
  it.each([
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['S/ 1,234.56', 1234.56],
    ['S/. 50', 50],
    ['-50.00', -50],
    ['50.00-', -50],
    ['(50.00)', -50],
    ['12,50', 12.5],
    ['1,234', 1234],
    ['1.234', 1234],
    ['1,234,567.80', 1234567.8],
    ['0.5', 0.5],
  ])('%s', (raw, n) => expect(parseCsvAmount(raw)).toBe(n))

  it.each(['', 'abc', 'US$ 10', '12a'])('not an amount: %s', (raw) => expect(parseCsvAmount(raw)).toBeNull())
})

describe('parseCsvDate', () => {
  it.each([
    ['25/10/2026', '2026-10-25'],
    ['25-10-2026', '2026-10-25'],
    ['25.10.2026', '2026-10-25'],
    ['5/1/26', '2026-01-05'],
    ['2026-10-25', '2026-10-25'],
    ['25/10/2026 14:30', '2026-10-25'],
  ])('%s', (raw, d) => expect(parseCsvDate(raw)).toBe(d))

  it.each(['31/02/2026', '2026-13-01', 'ayer', ''])('invalid: %s', (raw) => expect(parseCsvDate(raw)).toBeNull())
})

describe('parseCsvStatement (DATA-01)', () => {
  it('one signed amount column, semicolons, title lines above the header', () => {
    const r = parse(`Cuenta de ahorros;;\r\nDel 01/10/2026 al 31/10/2026;;\r\n\r\nFecha;Descripción;Monto\r\n01/10/2026;PAGO DE HABERES;3.500,00\r\n03/10/2026;TAMBO;-12,50\r\n`)
    expect(r.assumedExpenses).toBe(false)
    expect(r.rows).toEqual([
      { line: 5, date: '2026-10-01', description: 'PAGO DE HABERES', amount: 3500, type: 'income', category: 'salary' },
      { line: 6, date: '2026-10-03', description: 'TAMBO', amount: 12.5, type: 'expense', category: 'other' },
    ])
  })

  it('separate cargo and abono columns', () => {
    const r = parse(`Fecha,Glosa,Cargo,Abono\n02/10/2026,UBER,18.00,\n03/10/2026,TRANSFERENCIA,,250.00\n`)
    expect(r.rows.map((x) => [x.type, x.amount, x.category])).toEqual([
      ['expense', 18, 'transport'],
      ['income', 250, 'other'],
    ])
  })

  it('all positive in one column is read as expenses, and says so', () => {
    const r = parse(`Fecha,Comercio,Importe\n02/10/2026,NETFLIX,44.90\n05/10/2026,WONG,120.00\n`)
    expect(r.assumedExpenses).toBe(true)
    expect(r.rows.every((x) => x.type === 'expense')).toBe(true)
    expect(r.rows[0].category).toBe('subscriptions')
  })

  it('quotes hold delimiters and thousands separators', () => {
    const r = parse(`Fecha,Descripcion,Monto\n02/10/2026,"PLAZA VEA, SAN ISIDRO","-1,250.00"\n`)
    expect(r.rows[0]).toEqual(expect.objectContaining({ description: 'PLAZA VEA, SAN ISIDRO', amount: 1250 }))
  })

  it('a remembered category wins (US-24)', () => {
    const r = parse(`Fecha,Descripcion,Monto\n02/10/2026,ALMUERZO EN TAMBO,-10\n`, [{ pattern: 'almuerzo en tambo', category: 'home' }])
    expect(r.rows[0].category).toBe('home')
  })

  it('skips what it cannot trust, with the reason and line; dollars are never converted silently', () => {
    const r = parse(`Fecha,Descripcion,Monto,Moneda\n32/13/2026,MALA,-10,PEN\n02/10/2026,SIN MONTO,abc,PEN\n05/11/2030,FUTURO,-10,PEN\n02/10/2026,CERO,0,PEN\n02/10/2026,AMAZON,-20,USD\n02/10/2026,OK,-30,PEN\n`)
    expect(r.rows.map((x) => x.description)).toEqual(['OK'])
    expect(r.skipped).toEqual([
      { line: 2, reason: 'bad_date' },
      { line: 3, reason: 'bad_amount' },
      { line: 4, reason: 'future_date' },
      { line: 5, reason: 'zero_amount' },
      { line: 6, reason: 'usd' },
    ])
  })

  it('footers without date or amount are ignored', () => {
    const r = parse(`Fecha,Descripcion,Monto\n02/10/2026,OK,-30\nTotal de movimientos,,\n`)
    expect(r.rows).toHaveLength(1)
    expect(r.skipped).toEqual([])
  })

  it('tells empty, unknown and oversized files apart', () => {
    expect(parseCsvStatement('   ', { today })).toEqual({ ok: false, error: 'empty' })
    expect(parseCsvStatement('hola,mundo\n1,2\n', { today })).toEqual({ ok: false, error: 'no_header' })
    expect(parseCsvStatement('x'.repeat(CSV_MAX_CHARS + 1), { today })).toEqual({ ok: false, error: 'too_large' })
  })

  it('stops at the row limit and reports the rest', () => {
    const lines = Array.from({ length: CSV_MAX_ROWS + 3 }, (_, i) => `02/10/2026,M${i},-1`)
    const r = parse(`Fecha,Descripcion,Monto\n${lines.join('\n')}\n`)
    expect(r.rows).toHaveLength(CSV_MAX_ROWS)
    expect(r.skipped).toHaveLength(3)
    expect(r.skipped[0].reason).toBe('too_many_rows')
  })
})

describe('duplicateLines', () => {
  const rows = parse(`Fecha,Descripcion,Monto\n02/10/2026,Café,-10\n02/10/2026,CAFE,-10\n03/10/2026,Taxi,-20\n`).rows

  it('matches day, amount, type and description, ignoring case and accents', () => {
    const existing = [{ date: '2026-10-03', amount: 20, type: 'expense', description: 'taxi' }]
    expect([...duplicateLines(rows, existing)]).toEqual([4])
  })

  it('two equal movements are real: one registered leaves the other new', () => {
    const existing = [{ date: '2026-10-02', amount: 10, type: 'expense', description: 'cafe' }]
    expect([...duplicateLines(rows, existing)]).toEqual([2])
  })

  it('the same file twice adds nothing', () => {
    expect(duplicateLines(rows, rows).size).toBe(rows.length)
  })
})
