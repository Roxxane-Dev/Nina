import type { StatementLine } from '../../packages/finance-engine/src'

/**
 * DATA-02: turns a statement PDF into lines of text, in memory. Nothing is written to disk and the
 * password only lives for this call. A PDF is untrusted input, so eval, system fonts and external
 * resources stay off, and size and page count are capped.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 60
/** Two items are on the same line when their baselines are this close, in PDF points. */
const SAME_LINE_POINTS = 2
/** A gap this wide separates columns, so it survives as two spaces for the bank parsers. */
const COLUMN_GAP_POINTS = 8

export type PdfTextItem = { str: string; x: number; y: number; width: number }

export type PdfTextError = 'too_large' | 'password_required' | 'wrong_password' | 'too_many_pages' | 'no_text' | 'unreadable'
export type PdfTextResult = { ok: true; lines: StatementLine[]; pages: number } | { ok: false; error: PdfTextError }

/** Groups the positioned text of one page into lines, top to bottom, left to right. */
export function linesFromItems(items: PdfTextItem[]): StatementLine[] {
  const rows: Array<{ y: number; items: PdfTextItem[] }> = []
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y)
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= SAME_LINE_POINTS)
    if (row) row.items.push(item)
    else rows.push({ y: item.y, items: [item] })
  }
  return rows.map((row) => {
    const cells = row.items.sort((a, b) => a.x - b.x)
    let text = ''
    let end = -Infinity
    for (const c of cells) {
      if (text) text += c.x - end > COLUMN_GAP_POINTS ? '  ' : ' '
      text += c.str.trim()
      end = c.x + c.width
    }
    return { text, cells: cells.map((c) => ({ x: c.x, text: c.str.trim() })) }
  })
}

export function pdfErrorKind(err: unknown): 'password_required' | 'wrong_password' | 'unreadable' {
  const e = err as { name?: string; code?: number } | null
  if (e?.name !== 'PasswordException') return 'unreadable'
  // pdf.js: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD.
  return e.code === 2 ? 'wrong_password' : 'password_required'
}

type PdfjsPage = {
  getTextContent(): Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number }> }>
}
type PdfjsDocument = { numPages: number; getPage(n: number): Promise<PdfjsPage> }
type Pdfjs = {
  getDocument(params: Record<string, unknown>): { promise: Promise<PdfjsDocument>; destroy(): Promise<void> }
}

// Written this way so TypeScript keeps a real import(): pdf.js ships as an ES module only.
const loadPdfjs = () =>
  new Function('specifier', 'return import(specifier)')('pdfjs-dist/legacy/build/pdf.mjs') as Promise<Pdfjs>

export async function extractPdfLines(bytes: Uint8Array, password?: string, pdfjs?: Pdfjs): Promise<PdfTextResult> {
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, error: 'too_large' }
  const lib = pdfjs ?? (await loadPdfjs())
  const task = lib.getDocument({
    data: bytes,
    password,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    disableAutoFetch: true,
    verbosity: 0,
  })
  try {
    let doc: PdfjsDocument
    try {
      doc = await task.promise
    } catch (err) {
      return { ok: false, error: pdfErrorKind(err) }
    }
    if (doc.numPages > MAX_PDF_PAGES) return { ok: false, error: 'too_many_pages' }
    const lines: StatementLine[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const { items } = await page.getTextContent()
      lines.push(
        ...linesFromItems(
          items
            .filter((i) => typeof i.str === 'string' && Array.isArray(i.transform))
            .map((i) => ({ str: i.str!, x: i.transform![4], y: i.transform![5], width: i.width ?? 0 })),
        ),
      )
    }
    // A scanned statement is a picture: there is nothing to read without OCR.
    if (!lines.length) return { ok: false, error: 'no_text' }
    return { ok: true, lines, pages: doc.numPages }
  } catch {
    return { ok: false, error: 'unreadable' }
  } finally {
    // The loading task owns the worker and the file's memory; it is what gets released.
    await task.destroy().catch(() => undefined)
  }
}
