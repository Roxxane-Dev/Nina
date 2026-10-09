import { Injectable, Logger } from '@nestjs/common';
import { NormalizedTransaction } from '../financial-connectivity/transaction.types';

export interface IncomeProfile {
  monthlyAverage: number;
  isStable: boolean;
  volatility: number;
  nextExpectedDate: Date;
  patterns: string[];
}

@Injectable()
export class RecurringIncomeService {
  private readonly logger = new Logger(RecurringIncomeService.name);

  /**
   * Analyzes transactions to detect income patterns and salary stability.
   */
  analyzeIncome(transactions: NormalizedTransaction[]): IncomeProfile {
    const incomeTx = transactions.filter(t => t.isIncome);
    
    if (incomeTx.length === 0) {
      return { 
        monthlyAverage: 0, 
        isStable: false, 
        volatility: 0, 
        nextExpectedDate: new Date(), 
        patterns: [] 
      };
    }

    const avg = incomeTx.reduce((acc, t) => acc + t.amount, 0) / incomeTx.length;
    const isStable = incomeTx.length >= 3; // Basic heuristic

    return {
      monthlyAverage: avg,
      isStable,
      volatility: 0.1, // Mock
      nextExpectedDate: this.estimateNextDate(incomeTx),
      patterns: isStable ? ['monthly_salary'] : ['unstable_income'],
    };
  }

  private estimateNextDate(transactions: NormalizedTransaction[]): Date {
    const last = transactions[0].timestamp;
    const next = new Date(last);
    next.setMonth(next.getMonth() + 1);
    return next;
  }
}
