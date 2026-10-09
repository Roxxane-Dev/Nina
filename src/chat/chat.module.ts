import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { ExpensesModule } from '../expenses/expenses.module'
import { MemoryModule } from '../memory/memory.module'
import { IncomeModule } from '../income/income.module'
import { GoalsModule } from '../goals/goals.module'
import { FinanceEngineModule } from '../finance-engine/finance-engine.module'
import { NinaRouterModule } from '../nina-router/nina-router.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { PendingActionsStore } from './pending-actions.store'

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    ExpensesModule,
    MemoryModule,
    IncomeModule,
    GoalsModule,
    FinanceEngineModule,
    NinaRouterModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, PendingActionsStore],
})
export class ChatModule {}
