/**
 * Minimal in-memory stand-in for the Supabase query builder, enough for unit
 * tests of services that use the service-role client. Supports select with
 * eq/in filters, order, limit, single/maybeSingle, insert/update/delete/upsert
 * (+ select), and unique-key conflicts (code 23505).
 */
type Row = Record<string, unknown>
type Result = { data: unknown; error: { code: string; message: string } | null }

export class FakeSupabase {
  readonly tables: Record<string, Row[]> = {}
  constructor(private readonly uniqueKeys: Record<string, string[]> = {}, private readonly missing: string[] = []) {}

  from(table: string) {
    return new Query(this, table)
  }

  rows(table: string): Row[] {
    return (this.tables[table] ??= [])
  }

  isMissing(table: string) {
    return this.missing.includes(table)
  }

  conflict(table: string, row: Row): Row | undefined {
    const keys = this.uniqueKeys[table]
    if (!keys) return undefined
    return this.rows(table).find((r) => keys.every((k) => r[k] === row[k]))
  }
}

class Query implements PromiseLike<Result> {
  private filters: Array<(r: Row) => boolean> = []
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: Row | Row[] | null = null
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  private orderBy: { col: string; asc: boolean } | null = null
  private max: number | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'
  private returning = false

  constructor(private readonly db: FakeSupabase, private readonly table: string) {}

  select(_cols?: string) {
    if (this.op !== 'select') this.returning = true
    return this
  }
  insert(p: Row | Row[]) {
    this.op = 'insert'
    this.payload = p
    return this
  }
  update(p: Row) {
    this.op = 'update'
    this.payload = p
    return this
  }
  upsert(p: Row, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = 'upsert'
    this.payload = p
    this.upsertOpts = opts
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val)
    return this
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]))
    return this
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderBy = { col, asc: opts.ascending !== false }
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }
  maybeSingle() {
    this.mode = 'maybe'
    return this
  }

  then<T1 = Result, T2 = never>(ok?: ((v: Result) => T1 | PromiseLike<T1>) | null, ko?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(ok, ko)
  }

  private run(): Result {
    if (this.db.isMissing(this.table)) return { data: null, error: { code: 'PGRST205', message: 'missing table' } }
    const rows = this.db.rows(this.table)
    const match = (r: Row) => this.filters.every((f) => f(r))
    let out: Row[] = []

    if (this.op === 'insert') {
      for (const p of Array.isArray(this.payload) ? this.payload : [this.payload as Row]) {
        if (this.db.conflict(this.table, p)) return { data: null, error: { code: '23505', message: 'duplicate' } }
        const row = { id: `id-${rows.length + 1}-${this.table}`, ...p }
        rows.push(row)
        out.push(row)
      }
    } else if (this.op === 'upsert') {
      const p = this.payload as Row
      const existing = this.db.conflict(this.table, p)
      if (existing) {
        if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, p)
        out = [existing]
      } else {
        rows.push({ ...p })
        out = [p]
      }
    } else if (this.op === 'update') {
      out = rows.filter(match)
      out.forEach((r) => Object.assign(r, this.payload))
    } else if (this.op === 'delete') {
      out = rows.filter(match)
      this.db.tables[this.table] = rows.filter((r) => !match(r))
    } else {
      out = rows.filter(match)
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
      }
      if (this.max != null) out = out.slice(0, this.max)
    }

    const data = this.op === 'select' || this.returning ? out : null
    if (this.mode === 'single') return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not single' } }
    if (this.mode === 'maybe') return { data: out[0] ?? null, error: null }
    return { data, error: null }
  }
}
