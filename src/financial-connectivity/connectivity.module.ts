import { Module, Global } from '@nestjs/common';
import { SubscriptionIntelligenceService } from '../subscriptions/subscription-intelligence.service';
import { RecurringIncomeService } from '../recurring-income/recurring-income.service';
import { FinancialGraphService } from '../financial-graph/financial-graph.service';

@Global()
@Module({
  providers: [
    SubscriptionIntelligenceService,
    RecurringIncomeService,
    FinancialGraphService,
  ],
  exports: [
    SubscriptionIntelligenceService,
    RecurringIncomeService,
    FinancialGraphService,
  ],
})
export class ConnectivityModule {}
