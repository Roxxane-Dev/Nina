import { Injectable, Logger } from '@nestjs/common';
import { FinancialHealth } from '../context/context-packet';
import { FinancialHealthV2Service } from './financial-health-v2.service';

@Injectable()
export class FinancialHealthService {
  private readonly logger = new Logger(FinancialHealthService.name);

  constructor(private readonly healthV2: FinancialHealthV2Service) {}

  async calculateHealthScore(userId: string): Promise<FinancialHealth> {
    this.logger.warn(`[DEPRECATED] calculateHealthScore called. Redirecting to Health V2.`);
    return this.healthV2.computeHealth(userId, [], {
      totalBalance: 2000,
      averageMonthlySpending: 1200,
      currentMonthSpending: 800,
      budgetDeviation: 0.05,
      spendingVolatility: 0.1,
    });
  }
}
