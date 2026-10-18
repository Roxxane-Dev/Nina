import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { FinanceEngineController } from './finance-engine.controller'
import { FinanceEngineService } from './finance-engine.service'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [FinanceEngineController],
  providers: [FinanceEngineService],
  exports: [FinanceEngineService],
})
export class FinanceEngineModule {}
