import { Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { AIModule } from '../ai/ai.module';
import { CacheModule } from '../cache/cache.module';
import { FinancialLedgerModule } from '../financial-ledger/financial-ledger.module';

const logger = new Logger('JobsModule');

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AIModule,
    CacheModule,
    FinancialLedgerModule,
  ],
  providers: [
    SchedulerService,
  ],
})
export class JobsModule {
  constructor() {
    logger.log('[MODULE READY] JobsModule initialized');
  }
}
