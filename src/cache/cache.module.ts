import { Module, Logger } from '@nestjs/common';
import { IntelligenceCacheService } from './intelligence-cache.service';

/**
 * CacheModule — Single source of truth for IntelligenceCacheService.
 * Import this module anywhere cache access is needed.
 * Do NOT declare IntelligenceCacheService directly in other modules.
 */
@Module({
  providers: [IntelligenceCacheService],
  exports: [IntelligenceCacheService],
})
export class CacheModule {
  private readonly logger = new Logger('CacheModule');
  constructor() {
    this.logger.log('[MODULE READY] CacheModule initialized');
  }
}
