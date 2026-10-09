import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { ExpensesController } from './expenses.controller'
import { ExpensesService } from './expenses.service'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
