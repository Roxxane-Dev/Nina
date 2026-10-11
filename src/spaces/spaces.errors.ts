/** Shared-space tables/columns are missing: migration 017 has not been applied. */
export class SpacesNotReadyError extends Error {
  readonly code = 'SPACES_NOT_READY'
  constructor() {
    super('Shared spaces are not enabled (migration 017 pending)')
    this.name = 'SpacesNotReadyError'
  }
}

/** PostgREST / Postgres codes for "table or column does not exist". */
export function isMissingSchema(code: string | undefined): boolean {
  return code === 'PGRST205' || code === 'PGRST204' || code === '42P01' || code === '42703'
}
