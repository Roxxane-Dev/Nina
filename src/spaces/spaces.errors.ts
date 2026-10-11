import { FeatureNotReadyError } from '../common/feature-not-ready'

export { isMissingSchema } from '../common/feature-not-ready'

/** Shared-space tables/columns are missing: migration 017 has not been applied. */
export class SpacesNotReadyError extends FeatureNotReadyError {
  constructor() {
    super('SPACES_NOT_READY', 'Los espacios compartidos todavía no están activados. Inténtalo más tarde.')
    this.name = 'SpacesNotReadyError'
  }
}
