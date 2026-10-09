import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { AIModule } from './ai/ai.module'
import { ChatModule } from './chat/chat.module'
import { ExpensesModule } from './expenses/expenses.module'
import { HomeModule } from './home/home.module'
import { JobsModule } from './jobs/jobs.module'
import { RealtimeModule } from './realtime/realtime.module'
import { ConnectivityModule } from './financial-connectivity/connectivity.module'
import { IntelligenceModule } from './intelligence/intelligence.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AIModule,
    ChatModule,
    ExpensesModule,
    HomeModule,
    JobsModule,
    RealtimeModule,
    ConnectivityModule,
    IntelligenceModule,
  ],
})
export class AppModule { }
