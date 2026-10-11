import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { CategoryRulesModule } from '../category-rules/category-rules.module'
import { SpacesModule } from '../spaces/spaces.module'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'

@Module({
  imports: [ConfigModule, AuthModule, CategoryRulesModule, SpacesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
