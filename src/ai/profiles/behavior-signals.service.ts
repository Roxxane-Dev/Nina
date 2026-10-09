import { Injectable, Logger } from '@nestjs/common';
import { BehaviorSignals } from '../context/context-packet';

@Injectable()
export class BehaviorSignalsService {
  private readonly logger = new Logger(BehaviorSignalsService.name);

  /**
   * Infers behavioral signals from financial patterns and expenses.
   */
  async extractSignals(userId: string): Promise<BehaviorSignals> {
    this.logger.log(`Extracting behavioral signals for user ${userId}`);

    // Deterministic logic to parse expenses and behaviors
    // (Mocked for now, in reality reads from postgres transactions)
    return {
      weekend_overspending: true, // Example logic: compare weekend avg vs weekday avg
      stress_spending: false, // Inferred from emotional labels + rapid spending
      salary_spike_days: [1, 15], 
      late_night_ordering: true, // Transactions after 22:00
      food_delivery_dependency: 'high',
      savings_consistency: 'medium'
    };
  }
}
