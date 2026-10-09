import { Injectable, Logger } from '@nestjs/common';
import { NormalizedTransaction, RecurrenceType } from '../financial-connectivity/transaction.types';

export interface SubscriptionDetail {
  merchantName: string;
  monthlyAmount: number;
  lastPaymentDate: Date;
  recurrence: RecurrenceType;
  confidence: number;
  isUnused: boolean;
}

@Injectable()
export class SubscriptionIntelligenceService {
  private readonly logger = new Logger(SubscriptionIntelligenceService.name);

  /**
   * Detects subscriptions from a list of normalized transactions using deterministic heuristics.
   */
  detectSubscriptions(transactions: NormalizedTransaction[]): SubscriptionDetail[] {
    this.logger.log(`Analyzing ${transactions.length} transactions for subscription detection.`);
    const subscriptions: SubscriptionDetail[] = [];

    // Group by merchant
    const merchantGroups = this.groupByMerchant(transactions);

    for (const [merchant, merchantTransactions] of Object.entries(merchantGroups)) {
      if (this.isRecurring(merchantTransactions)) {
        subscriptions.push({
          merchantName: merchant,
          monthlyAmount: this.calculateAverageAmount(merchantTransactions),
          lastPaymentDate: merchantTransactions[0].timestamp,
          recurrence: RecurrenceType.MONTHLY,
          confidence: 0.9,
          isUnused: false, // Future logic
        });
      }
    }

    return subscriptions;
  }

  private groupByMerchant(transactions: NormalizedTransaction[]): Record<string, NormalizedTransaction[]> {
    return transactions.reduce((acc, t) => {
      const name = t.merchant.name;
      if (!acc[name]) acc[name] = [];
      acc[name].push(t);
      return acc;
    }, {} as Record<string, NormalizedTransaction[]>);
  }

  private isRecurring(transactions: NormalizedTransaction[]): boolean {
    if (transactions.length < 2) return false;
    
    // Sort by date desc
    const sorted = [...transactions].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Check interval between last two
    const diff = sorted[0].timestamp.getTime() - sorted[1].timestamp.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    
    // Basic monthly detection (27-33 days)
    return days >= 27 && days <= 33;
  }

  private calculateAverageAmount(transactions: NormalizedTransaction[]): number {
    const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
    return sum / transactions.length;
  }
}
