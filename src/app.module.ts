import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { AIModule } from './ai/ai.module'
import { ChatModule } from './chat/chat.module'
import { ExpensesModule } from './expenses/expenses.module'
import { JobsModule } from './jobs/jobs.module'
import { RealtimeModule } from './realtime/realtime.module'
import { ConnectivityModule } from './financial-connectivity/connectivity.module'
import { FinanceEngineModule } from './finance-engine/finance-engine.module'
import { TransactionsModule } from './transactions/transactions.module'
import { SpacesModule } from './spaces/spaces.module'
import { ConsentsModule } from './consents/consents.module'
import { MeModule } from './me/me.module'
import { AccountsModule } from './accounts/accounts.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AIModule,
    ChatModule,
    ExpensesModule,
    JobsModule,
    RealtimeModule,
    ConnectivityModule,
    FinanceEngineModule,
    TransactionsModule,
    SpacesModule,
    ConsentsModule,
    MeModule,
    AccountsModule,
  ],
})
export class AppModule { }
