import { parseStatement, reconcile, type StatementLine } from './statements'

// Synthetic statement with the layout of a BCP card statement. No real data.
const STATEMENT = `
Estado de Cuenta Tarjeta VISA
Ciclo de Facturación
Del  Al
11/08/26  10/09/26
Pago mínimo S/  Pago total S/
50.00  1,000.00
Fecha de proceso  Fecha de consumo  Descripción  Tipo de Operación  Soles  Dólares
SALDO ANTERIOR  1,500.00
PERSONA DE PRUEBA  12345 6XXXXXX0000
11Ago  11Ago  RECIBO DE LUZ  PAGOSERVIC  100.00
17Ago  16Ago  PAGO BANCA MOVIL  PAGO  800.00-
17Ago  14Ago  DLC*UBER RIDES  LIMA  PE  CONSUMO  40.00
28Ago  27Ago  CLINICA DE PRUEBA  LIMA  PE  CONSUMO  50.00
PERSONA DE PRUEBA  12345 6XXXXXX9999
10Set  10Set  DEVOLUCION MEMBRESIA  DEVOLUCION  30.00-
10Set  10Set  INTERESES  CARGO  140.00
¿Cómo calcular tu pago mínimo?
`
const lines = (text = STATEMENT): StatementLine[] => text.trim().split('\n').map((t) => ({ text: t }))
const today = new Date('2026-11-01T00:00:00Z')
const parse = (text?: string) => {
  const r = parseStatement(lines(text), { today })
  if (!r) throw new Error('not recognized')
  return r
}

describe('reconcile', () => {
  it('compares opening + movements with what the bank printed', () => {
    expect(reconcile(100, 50, 150)).toEqual({ ok: true, expected: 150, stated: 150, difference: 0 })
    expect(reconcile(100, 50, 340.11)).toEqual({ ok: false, expected: 150, stated: 340.11, difference: 190.11 })
    expect(reconcile(null, 50, 150)).toBeNull()
    expect(reconcile(100, 50, null)).toBeNull()
  })

  it('floating point never breaks a real match', () => {
    expect(reconcile(0.1, 0.2, 0.3)?.ok).toBe(true)
  })
})

describe('parseStatement: BCP card (DATA-02)', () => {
  it('reads the cycle and the consumption date, not the processing date', () => {
    const r = parse()
    expect(r.period).toEqual({ from: '2026-08-11', to: '2026-09-10' })
    expect(r.rows.find((x) => x.description === 'DLC*UBER RIDES')?.date).toBe('2026-08-14')
  })

  it('classifies expenses, services, refunds and bank charges', () => {
    expect(parse().rows.map((x) => [x.description, x.type, x.category, x.amount])).toEqual([
      ['RECIBO DE LUZ', 'expense', 'services', 100],
      ['DLC*UBER RIDES', 'expense', 'transport', 40],
      ['CLINICA DE PRUEBA', 'expense', 'health', 50],
      ['DEVOLUCION MEMBRESIA', 'income', 'debt', 30],
      ['INTERESES', 'expense', 'debt', 140],
    ])
  })

  it('a payment to the card is neither income nor spending, but it counts for the balance', () => {
    const r = parse()
    expect(r.rows.some((x) => /PAGO BANCA/.test(x.description))).toBe(false)
    expect(r.skipped).toEqual([{ line: 11, reason: 'card_payment' }])
  })

  it('checks out against the printed balance', () => {
    expect(parse().reconciliation).toEqual({ ok: true, expected: 1000, stated: 1000, difference: 0 })
  })

  it('a missing row is caught, with the exact difference', () => {
    const r = parse(STATEMENT.replace('10Set  10Set  INTERESES  CARGO  140.00\n', ''))
    expect(r.reconciliation).toEqual({ ok: false, expected: 860, stated: 1000, difference: 140 })
  })

  it('a card holder line is never a movement', () => {
    expect(parse().rows.some((x) => /PERSONA/.test(x.description))).toBe(false)
  })

  it('December consumption in a January cycle belongs to the previous year', () => {
    const r = parse(STATEMENT.replace('11/08/26  10/09/26', '11/12/26  10/01/27').replace('28Ago  27Ago', '28Dic  27Dic').replace('10Set  10Set  INTERESES', '09Ene  09Ene  INTERESES'))
    expect(r.rows.find((x) => x.description === 'CLINICA DE PRUEBA')?.date).toBe('2026-12-27')
    expect(r.rows.find((x) => x.description === 'INTERESES')?.date).toBe('2027-01-09')
  })

  it('an amount in the Dólares column is skipped and stays out of the soles balance', () => {
    // Column headers come glued like this from the real PDF reader.
    const header = { text: 'Tipo de OperaciónSoles  Dólares', cells: [{ x: 400, text: 'Tipo de OperaciónSoles' }, { x: 560, text: 'Dólares' }] }
    const usd = { text: '12Ago  12Ago  AMAZON  CONSUMO  20.00', cells: [{ x: 60, text: 'AMAZON' }, { x: 400, text: 'CONSUMO' }, { x: 570, text: '20.00' }] }
    const base = lines().filter((l) => !l.text.startsWith('Fecha de proceso'))
    const r = parseStatement([{ text: 'Estado de Cuenta Tarjeta VISA' }, header, ...base.slice(1), usd], { today })!
    expect(r.rows.some((x) => x.description === 'AMAZON')).toBe(false)
    expect(r.skipped).toContainEqual({ line: 18, reason: 'usd' })
    expect(r.reconciliation?.ok).toBe(true)
  })

  it('an amount in the Soles column stays in soles', () => {
    const header = { text: 'Soles  Dólares', cells: [{ x: 500, text: 'Soles' }, { x: 560, text: 'Dólares' }] }
    const soles = { text: '12Ago  12Ago  TIENDA  CONSUMO  20.00', cells: [{ x: 60, text: 'TIENDA' }, { x: 505, text: '20.00' }] }
    const r = parseStatement([...lines(), header, soles], { today })!
    expect(r.rows.some((x) => x.description === 'TIENDA')).toBe(true)
  })

  it('a dollar row that slips through is caught by the balance check', () => {
    const r = parse(STATEMENT.replace('¿Cómo', '12Ago  12Ago  AMAZON  CONSUMO  20.00\n¿Cómo'))
    expect(r.reconciliation).toEqual({ ok: false, expected: 1020, stated: 1000, difference: -20 })
  })

  it('an unknown credit is not imported, and the reason is reported', () => {
    const r = parse(STATEMENT.replace('INTERESES  CARGO  140.00', 'AJUSTE RARO  AJUSTE  140.00-'))
    expect(r.skipped).toContainEqual({ line: 16, reason: 'unknown_operation' })
    expect(r.rows.some((x) => x.description === 'AJUSTE RARO')).toBe(false)
  })

  it('a remembered category wins (US-24)', () => {
    const r = parseStatement(lines(), { today, rules: [{ pattern: 'clinica de prueba', category: 'home' }] })!
    expect(r.rows.find((x) => x.description === 'CLINICA DE PRUEBA')?.category).toBe('home')
  })

  it('does not recognize other documents', () => {
    expect(parseStatement([{ text: 'Una factura cualquiera' }], { today })).toBeNull()
  })
})

describe('parseStatement: BCP card, layout of the real 3-page PDF (synthetic data)', () => {
  // Structure checked against a real statement on 2026-11-04; every name and amount here is invented.
  const REAL = `
Pag 1  de 3
Estado de Cuenta Tarjeta VISA
Fecha de Facturación  Del  Al (día de cierre)
PRUEBA SA  PERSONA X  1234-56XX-XXXX-7890  11/08/26  10/09/26
Pagos
Pago mínimo S/  Pago total S/  En caso pague pasada la fecha se cobra 0.0% del pago mínimo (en soles min
10.00  245.00
Pago mínimo US$  Pago total US$
0.00  0.00
Fecha de  Fecha de  Descripción  Tipo de  Soles  Dólares
proceso  consumo  Operación
SALDO ANTERIOR  500.00
PERSONA X  123456XXXXXX0000
11Ago  11Ago  TELE0000000001  PAGOSERVIC  30.00
17Ago  16Ago  PAGO BANCA MOVIL  PAGO  400.00-
20Ago  19Ago  DLC*RAPPI PERU  LIMA  PE  CONSUMO  45.00
22Ago  21Ago  TIENDA DESCONOCIDA  LIMA  PE  CONSUMO  50.00
PERSONA X  123456XXXXXX9999
10Set  10Set  DEVOLUCION MEMBRESIA  DEVOLUCION  100.00-
¿Cómo calcular tu pago mínimo?
FECHA DE COBRO DE MEMBRESIA: 10/09/2027 - MONTO S/ 100.00 - PERIODO Del 01/09/2026 al 31/08/2027
Pag 2  de 3
Fecha de  Fecha de  Descripción  Tipo de  Soles  Dólares
proceso  consumo  Operación
INTERESES  12.00
COMISION POR USO DE CANALES
SUB TOTAL  137.00
ENVIO FISICO DE ESTADO DE  CUENTA
GASTO MENSUAL POR SEGURO DE  DESGRAVAMEN  8.00
COMISION ANUAL POR MEMBRESIA  100.00
MONTO TOTAL FACTURADO  245.00
DETALLE PLAN CUOTAS SOLES
20Ago  20Ago  PREPAGO CREDITO E  999.99
Saldo Total  245.00
`
  const r = parseStatement(lines(REAL), { today })!

  it('is recognized although "Tipo de / Operación" spans two lines', () => {
    expect(r).not.toBeNull()
    expect(r.period).toEqual({ from: '2026-08-11', to: '2026-09-10' })
  })

  it('reads page 2 charges with the cycle close as their date, and ignores the subtotal', () => {
    expect(r.rows.filter((x) => x.category === 'debt').map((x) => [x.description, x.amount, x.date])).toEqual([
      ['INTERESES', 12, '2026-09-10'],
      ['GASTO MENSUAL POR SEGURO DE DESGRAVAMEN', 8, '2026-09-10'],
    ])
    expect(r.rows.some((x) => /SUB TOTAL|COMISION POR USO/.test(x.description))).toBe(false)
  })

  it('a charge refunded in the same statement cancels out instead of showing up as income', () => {
    expect(r.rows.some((x) => x.type === 'income')).toBe(false)
    expect(r.rows.some((x) => /MEMBRESIA/.test(x.description))).toBe(false)
    expect(r.skipped.filter((s) => s.reason === 'refunded')).toHaveLength(2)
  })

  it('the installment plan detail after the total is informative, not a movement', () => {
    expect(r.rows.some((x) => /PREPAGO/.test(x.description))).toBe(false)
  })

  it('checks out against MONTO TOTAL FACTURADO', () => {
    expect(r.reconciliation).toEqual({ ok: true, expected: 245, stated: 245, difference: 0 })
  })

  it('knows common Peruvian merchants', () => {
    expect(r.rows.find((x) => x.description === 'DLC*RAPPI PERU')?.category).toBe('food')
  })

  it('a stray "en dólares" label is not the dollar column', () => {
    const withCells = lines(REAL).map((l) =>
      l.text === 'Fecha de  Fecha de  Descripción  Tipo de  Soles  Dólares'
        ? { ...l, cells: [{ x: 410, text: 'Tipo de' }, { x: 471, text: 'Soles' }, { x: 524, text: 'Dólares' }] }
        : /^(11Ago|20Ago|22Ago)/.test(l.text)
          ? { ...l, cells: [{ x: 47, text: l.text.slice(0, 5) }, { x: 490, text: l.text.split(/\s+/).pop()! }] }
          : l,
    )
    withCells.unshift({ text: 'en dólares', cells: [{ x: 300, text: 'en dólares' }] })
    expect(parseStatement(withCells, { today })!.rows.length).toBe(r.rows.length)
  })
})
