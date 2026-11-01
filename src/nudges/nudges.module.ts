import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { FinanceEngineModule } from '../finance-engine/finance-engine.module'
import { GoalsModule } from '../goals/goals.module'
import { NudgesController } from './nudges.controller'
import { NudgesService } from './nudges.service'

@Module({
  imports: [ConfigModule, AuthModule, FinanceEngineModule, GoalsModule],
  controllers: [NudgesController],
  providers: [NudgesService],
})
export class NudgesModule {}
