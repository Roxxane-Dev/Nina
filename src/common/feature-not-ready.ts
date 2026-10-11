/**
 * A feature whose tables/columns are not in the database yet (its migration is
 * pending). Answered as 503 with `code` and a user-facing Spanish message.
 */
export class FeatureNotReadyError extends Error {
  constructor(readonly code: string, readonly userMessage: string) {
    super(`${code}: migration pending`)
    this.name = 'FeatureNotReadyError'
  }
}

/** PostgREST / Postgres codes for "table or column does not exist". */
export function isMissingSchema(code: string | undefined): boolean {
  return code === 'PGRST205' || code === 'PGRST204' || code === '42P01' || code === '42703'
}
