import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FinanceEngineModule } from '../finance-engine/finance-engine.module';
import { GoalService } from './goal.service';
import { GoalsController } from './goals.controller';

@Module({
  imports: [ConfigModule, AuthModule, FinanceEngineModule],
  controllers: [GoalsController],
  providers: [GoalService],
  exports: [GoalService],
})
export class GoalsModule {}
