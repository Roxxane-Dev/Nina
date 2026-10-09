import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { IncomeService } from './income.service'

@Module({
  imports: [ConfigModule],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {}
