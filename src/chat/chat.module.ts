import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { ExpensesModule } from '../expenses/expenses.module'
import { MemoryModule } from '../memory/memory.module'
import { IncomeModule } from '../income/income.module'
import { GoalsModule } from '../goals/goals.module'
import { FinanceEngineModule } from '../finance-engine/finance-engine.module'
import { NinaRouterModule } from '../nina-router/nina-router.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { ChatTelemetry } from './chat-telemetry'
import { ConfirmationTokens, confirmationSecret } from './confirmation-token'
import { ConfirmationHandler } from './intents/confirmation.handler'
import { GeneralHandler } from './intents/general.handler'
import { BalanceQueryHandler, SpendingQueryHandler } from './intents/query.handlers'
import { QueryResponder } from './intents/query-responder'
import {
  RegisterExpenseHandler,
  RegisterGoalHandler,
  RegisterIncomeHandler,
} from './intents/registration.handlers'

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
  providers: [
    ChatService,
    ChatTelemetry,
    QueryResponder,
    ConfirmationHandler,
    RegisterIncomeHandler,
    RegisterGoalHandler,
    RegisterExpenseHandler,
    BalanceQueryHandler,
    SpendingQueryHandler,
    GeneralHandler,
    {
      provide: ConfirmationTokens,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ConfirmationTokens(
          confirmationSecret({
            CHAT_CONFIRM_SECRET: config.get<string>('CHAT_CONFIRM_SECRET'),
            SUPABASE_SERVICE_ROLE_KEY: config.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
          }),
        ),
    },
  ],
})
export class ChatModule {}
