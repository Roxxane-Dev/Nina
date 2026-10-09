import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { IntelligenceController } from './intelligence.controller'
import { NinaFinanceEngine } from './nina-finance.engine'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [IntelligenceController],
  providers: [NinaFinanceEngine],
  exports: [NinaFinanceEngine],
})
export class IntelligenceModule {}
