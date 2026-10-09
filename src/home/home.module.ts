import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HomeController } from './home.controller';
import { HomeIntelligenceService } from './home-intelligence.service';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { FinancialLedgerModule } from '../financial-ledger/financial-ledger.module';

@Module({
  imports: [ConfigModule, AuthModule, CacheModule, FinancialLedgerModule],
  controllers: [HomeController],
  providers: [HomeIntelligenceService],
  exports: [HomeIntelligenceService],
})
export class HomeModule {}
