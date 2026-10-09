import { Injectable, Logger } from '@nestjs/common';

export interface BehavioralRegressionEvent {
  type: string;
  severity: 'low' | 'medium' | 'high';
  recoveryProbability: number;
  historicalSimilarity: number;
  emotionalImpact: 'low' | 'medium' | 'high';
}

@Injectable()
export class BehavioralRegressionService {
  private readonly logger = new Logger(BehavioralRegressionService.name);

  async detectRegressions(userId: string, currentState: any, prevHabits: any): Promise<BehavioralRegressionEvent[]> {
    const regressions: BehavioralRegressionEvent[] = [];

    // 1. Detect Streak Break
    if (currentState.streaks_broken && currentState.streaks_broken.includes('savings')) {
      regressions.push({
        type: 'savings_streak_broken',
        severity: 'medium',
        recoveryProbability: 0.7,
        historicalSimilarity: 0.8,
        emotionalImpact: 'medium',
      });
    }

    // 2. Detect Resumed Impulsive Spending
    if (currentState.impulsive_spending && !prevHabits.impulsive_spending) {
      regressions.push({
        type: 'impulsive_spending_resumed',
        severity: 'high',
        recoveryProbability: 0.5,
        historicalSimilarity: 0.9,
        emotionalImpact: 'high',
      });
    }

    return regressions;
  }
}
