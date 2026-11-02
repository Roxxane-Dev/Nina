import { extractPdfLines, linesFromItems, MAX_PDF_BYTES, MAX_PDF_PAGES, pdfErrorKind, type PdfTextItem } from './pdf-text'

const item = (str: string, x: number, y: number, width = 20): PdfTextItem => ({ str, x, y, width })
const text = (items: PdfTextItem[]) => linesFromItems(items).map((l) => l.text)

// Same shape as pdf.js: only the loading task has destroy(), the document does not.
const fakePdfjs = (doc: unknown, fail?: unknown) => {
  const params: Array<Record<string, unknown>> = []
  const destroy = jest.fn(async () => undefined)
  return {
    params,
    destroy,
    getDocument: (p: Record<string, unknown>) => {
      params.push(p)
      return { promise: fail ? Promise.reject(fail) : Promise.resolve(doc as never), destroy }
    },
  }
}
const pageWith = (items: unknown[]) => ({ getTextContent: async () => ({ items }) })

describe('linesFromItems', () => {
  it('orders top to bottom and left to right, whatever the PDF order', () => {
    expect(text([item('abajo', 10, 100), item('derecha', 60, 200), item('izquierda', 10, 200)])).toEqual([
      'izquierda  derecha',
      'abajo',
    ])
  })

  it('joins items of one line despite small baseline differences', () => {
    expect(text([item('01/10', 10, 300), item('TAMBO', 32, 301)])).toEqual(['01/10 TAMBO'])
  })

  it('keeps a wide gap as a column break, and the position of each cell', () => {
    const [line] = linesFromItems([item('TAMBO', 10, 300, 30), item('12.50', 200, 300, 30)])
    expect(line.text).toBe('TAMBO  12.50')
    expect(line.cells).toEqual([{ x: 10, text: 'TAMBO' }, { x: 200, text: '12.50' }])
  })

  it('ignores blank items', () => {
    expect(text([item('   ', 10, 300)])).toEqual([])
  })
})

describe('extractPdfLines', () => {
  const bytes = new Uint8Array([1, 2, 3])

  it('turns eval, system fonts and auto fetching off, and passes the password', async () => {
    const lib = fakePdfjs({ numPages: 1, getPage: async () => pageWith([{ str: 'hola', transform: [1, 0, 0, 1, 10, 20], width: 10 }]) })
    const out = await extractPdfLines(bytes, 'secreto', lib as never)
    expect(out).toEqual({ ok: true, lines: [{ text: 'hola', cells: [{ x: 10, text: 'hola' }] }], pages: 1 })
    expect(lib.params[0]).toEqual(expect.objectContaining({ password: 'secreto', isEvalSupported: false, useSystemFonts: false, disableAutoFetch: true }))
  })

  it('refuses oversized files before opening them', async () => {
    const lib = fakePdfjs({})
    expect(await extractPdfLines(new Uint8Array(MAX_PDF_BYTES + 1), undefined, lib as never)).toEqual({ ok: false, error: 'too_large' })
    expect(lib.params).toEqual([])
  })

  it('refuses too many pages and always releases the file', async () => {
    const lib = fakePdfjs({ numPages: MAX_PDF_PAGES + 1 })
    expect(await extractPdfLines(bytes, undefined, lib as never)).toEqual({ ok: false, error: 'too_many_pages' })
    expect(lib.destroy).toHaveBeenCalled()
  })

  it('a scanned statement says so', async () => {
    const lib = fakePdfjs({ numPages: 1, getPage: async () => pageWith([]) })
    expect(await extractPdfLines(bytes, undefined, lib as never)).toEqual({ ok: false, error: 'no_text' })
  })

  it('tells a missing password from a wrong one', async () => {
    const pw = (code: number) => Object.assign(new Error('x'), { name: 'PasswordException', code })
    expect(await extractPdfLines(bytes, undefined, fakePdfjs(null, pw(1)) as never)).toEqual({ ok: false, error: 'password_required' })
    expect(await extractPdfLines(bytes, 'mal', fakePdfjs(null, pw(2)) as never)).toEqual({ ok: false, error: 'wrong_password' })
    expect(pdfErrorKind(new Error('roto'))).toBe('unreadable')
  })
})
