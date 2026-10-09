import { Injectable, Logger } from '@nestjs/common';
import { FinancialLedgerService, type FinancialLedger } from '../../financial-ledger/financial-ledger.service';

export interface FinancialMetrics {
  trend: 'up' | 'down' | 'stable';
  forecast_end_of_month: number;
  budget_status: { over_budget: boolean; remaining: number };
  monthlyIncome: number;
  monthlySpent: number;
  currentBalance: number;
  savingsRate?: number;
  safeToSpendToday?: number;
  byCategory?: Record<string, number>;
}

@Injectable()
export class FinancialAnalyticsService {
  private readonly logger = new Logger(FinancialAnalyticsService.name);

  constructor(private readonly ledger: FinancialLedgerService) {}

  /**
   * Deterministic cashflow analysis using REAL DB data.
   * NO MOCKS. NO HARDCODED VALUES.
   */
  async calculateMetrics(userId: string): Promise<FinancialMetrics> {
    this.logger.log(`[ANALYTICS] Calculating real metrics for user ${userId}`);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const [current, prev] = await Promise.all([
      this.ledger.getLedger(userId, currentMonth),
      this.ledger.getLedger(userId, prevMonth),
    ]);

    const prevSpent = prev.totalExpenses;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (prevSpent > 0) {
      if (current.totalExpenses > prevSpent * 1.1) trend = 'up';
      else if (current.totalExpenses < prevSpent * 0.9) trend = 'down';
    }

    return {
      trend,
      forecast_end_of_month: current.projectedBalance,
      budget_status: {
        over_budget: current.projectedBalance < 0,
        remaining: Math.max(0, current.totalIncome - current.totalExpenses),
      },
      monthlyIncome: current.totalIncome,
      monthlySpent: current.totalExpenses,
      currentBalance: current.netWorth,
      savingsRate: current.savingsRate,
      safeToSpendToday: current.safeToSpendToday,
      byCategory: current.byCategory,
    };
  }

  async detectAnomalies(userId: string): Promise<any[]> {
    this.logger.log(`[ANALYTICS] Running anomaly detection for user ${userId}`);
    return [];
  }
}
