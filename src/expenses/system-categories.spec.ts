import * as fs from 'fs'
import * as path from 'path'
import { CATEGORY_LABELS_ES } from '../../packages/finance-engine/src'

/**
 * Regression: a database built from the migrations had no system categories, so registering any
 * movement from the chat threw 'Category "transport" not found and no fallback'.
 * ExpensesService.resolveCategory needs a system row for every canonical slug (and 'other').
 */
describe('system categories migration', () => {
  const dir = path.join(__dirname, '../../supabase/migrations')
  const file = fs.readdirSync(dir).find((f) => f.endsWith('_system_categories.sql'))

  it('exists', () => {
    expect(file).toBeDefined()
  })

  const sql = file ? fs.readFileSync(path.join(dir, file), 'utf8') : ''

  it.each(Object.keys(CATEGORY_LABELS_ES))('seeds the canonical slug "%s" as a system category', (slug) => {
    expect(sql).toMatch(new RegExp(`'${slug}',\\s*'(expense|income)',\\s*true`))
  })

  it('uses the engine labels', () => {
    for (const [slug, label] of Object.entries(CATEGORY_LABELS_ES)) {
      expect(sql).toMatch(new RegExp(`\\('${label}',\\s*'${slug}'`))
    }
  })

  it('is idempotent', () => {
    expect(sql).toMatch(/on conflict \(normalized_name\) do nothing/)
  })

  it('does not depend on columns the production schema lacks', () => {
    expect(sql).not.toMatch(/emoji/i)
  })
})
