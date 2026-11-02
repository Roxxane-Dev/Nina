import { BadRequestException } from '@nestjs/common'
import { FakeSupabase } from '../testing/fake-supabase'
import { extractPdfLines } from '../statements/pdf-text'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'

jest.mock('../statements/pdf-text', () => ({ ...jest.requireActual('../statements/pdf-text'), extractPdfLines: jest.fn() }))
const extract = extractPdfLines as jest.Mock

// Synthetic statement with the layout of a BCP card statement. No real data.
const LINES = [
  'Estado de Cuenta Tarjeta VISA',
  '11/08/26  10/09/26',
  'Pago mínimo S/  Pago total S/',
  '5.00  150.00',
  'Fecha de proceso  Fecha de consumo  Descripción  Tipo de Operación  Soles  Dólares',
  'SALDO ANTERIOR  200.00',
  '11Ago  11Ago  RECIBO DE LUZ  PAGOSERVIC  50.00',
  '17Ago  16Ago  PAGO BANCA MOVIL  PAGO  100.00-',
].map((text) => ({ text }))

const pdf = { buffer: Buffer.from('%PDF-1.7 fake') }
const req = { user: { id: 'ana' } } as never

function setup() {
  const db = new FakeSupabase()
  const svc = new TransactionsService({ get: () => undefined } as never)
  ;(svc as unknown as { db: unknown }).db = db
  const ctrl = new TransactionsController(svc, { listForUser: async () => [] } as never, {} as never, {} as never)
  return { db, ctrl }
}

describe('DATA-02: import a statement PDF', () => {
  beforeEach(() => extract.mockReset())

  it('previews without saving, with the balance check', async () => {
    extract.mockResolvedValue({ ok: true, lines: LINES, pages: 1 })
    const t = setup()
    const out = await t.ctrl.previewPdf(req, pdf, { password: 'secreto' })
    expect(extract).toHaveBeenCalledWith(expect.any(Uint8Array), 'secreto')
    expect(out.reconciliation).toEqual({ ok: true, expected: 150, stated: 150, difference: 0 })
    expect(out.rows).toHaveLength(1)
    expect(out.skipped).toEqual([{ line: 8, reason: 'card_payment' }])
    expect(t.db.rows('transactions')).toEqual([])
  })

  it('imports for the JWT user, marked as pdf, and twice adds nothing', async () => {
    extract.mockResolvedValue({ ok: true, lines: LINES, pages: 1 })
    const t = setup()
    expect(await t.ctrl.commitPdf(req, pdf, {})).toEqual({ imported: 1, duplicates: 0 })
    expect(t.db.rows('transactions')).toEqual([expect.objectContaining({ user_id: 'ana', source_table: 'pdf', amount: 50, category: 'services' })])
    expect(await t.ctrl.commitPdf(req, pdf, {})).toEqual({ imported: 0, duplicates: 1 })
  })

  it('leaves out the lines the user unchecked', async () => {
    extract.mockResolvedValue({ ok: true, lines: LINES, pages: 1 })
    const t = setup()
    expect(await t.ctrl.commitPdf(req, pdf, { skipLines: '[7]' })).toEqual({ imported: 0, duplicates: 0 })
  })

  it('a locked PDF answers with a code the app can use, never with the password', async () => {
    extract.mockResolvedValue({ ok: false, error: 'password_required' })
    const err = await setup().ctrl.previewPdf(req, pdf, {}).catch((e) => e)
    expect(err).toBeInstanceOf(BadRequestException)
    expect(err.getResponse()).toEqual(expect.objectContaining({ code: 'password_required' }))
  })

  it('an unknown statement or a file that is not a PDF is 400', async () => {
    extract.mockResolvedValue({ ok: true, lines: [{ text: 'Factura' }], pages: 1 })
    const err = await setup().ctrl.previewPdf(req, pdf, {}).catch((e) => e)
    expect(err.getResponse()).toEqual(expect.objectContaining({ code: 'unsupported' }))
    await expect(setup().ctrl.previewPdf(req, { buffer: Buffer.from('hola') }, {})).rejects.toBeInstanceOf(BadRequestException)
    expect(extract).toHaveBeenCalledTimes(1)
  })
})
