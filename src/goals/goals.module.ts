import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoalService } from './goal.service';

@Module({
  imports: [ConfigModule],
  providers: [GoalService],
  exports: [GoalService],
})
export class GoalsModule {}
