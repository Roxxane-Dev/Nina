/** The transactions source could not be read (DB down, permission, network). Not "no data". */
export class FinanceDataUnavailableError extends Error {
  readonly code = 'DATA_UNAVAILABLE'
  constructor(readonly cause?: string) {
    super('Financial data unavailable')
    this.name = 'FinanceDataUnavailableError'
  }
}
