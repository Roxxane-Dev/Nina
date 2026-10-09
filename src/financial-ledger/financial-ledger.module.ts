import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FinancialLedgerService } from './financial-ledger.service'

@Module({
  imports: [ConfigModule],
  providers: [FinancialLedgerService],
  exports: [FinancialLedgerService],
})
export class FinancialLedgerModule {}
