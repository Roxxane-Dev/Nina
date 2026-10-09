import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AIModule } from '../ai/ai.module'
import { ExpensesModule } from '../expenses/expenses.module'
import { MemoryModule } from '../memory/memory.module'
import { InsightsModule } from '../insights/insights.module'
import { IncomeModule } from '../income/income.module'
import { GoalsModule } from '../goals/goals.module'
import { IntelligenceModule } from '../intelligence/intelligence.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [
    AuthModule,
    AIModule,
    ExpensesModule,
    MemoryModule,
    InsightsModule,
    IncomeModule,
    GoalsModule,
    IntelligenceModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
