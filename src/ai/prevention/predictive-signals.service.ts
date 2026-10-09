import { Injectable, Logger } from '@nestjs/common';

export interface PredictiveSignal {
  type: string;
  probability: number;
  window: string;
  context: string;
}

@Injectable()
export class PredictiveSignalsService {
  private readonly logger = new Logger(PredictiveSignalsService.name);

  async generatePredictiveSignals(userId: string, userHistory: any): Promise<PredictiveSignal[]> {
    const signals: PredictiveSignal[] = [];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    // 1. High Salary Risk Window (Day 25-30 of the month)
    if (now.getDate() >= 25) {
      signals.push({
        type: 'high_salary_risk_window',
        probability: 0.75,
        window: 'Next 5 days',
        context: 'Historically, your spending spikes immediately after receiving your salary.',
      });
    }

    // 2. Weekend Relapse Probability
    if (dayOfWeek >= 5) { // Friday or Saturday
      signals.push({
        type: 'weekend_relapse_probability',
        probability: 0.6,
        window: 'Next 48 hours',
        context: 'Weekend leisure spending often exceeds your planned limits.',
      });
    }

    // 3. Post-Midnight Spending Risk
    signals.push({
      type: 'post_midnight_spending_risk',
      probability: 0.4,
      window: '00:00 - 04:00 AM',
      context: 'Late night browsing leads to non-essential purchases.',
    });

    return signals;
  }
}
