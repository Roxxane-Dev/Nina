import { Injectable, Logger } from '@nestjs/common';

export enum EmotionalState {
  STABLE = 'stable',
  STRESS_SPENDING = 'stress_spending',
  IMPULSIVE = 'impulsive',
  AVOIDANCE = 'avoidance',
  GOAL_MOTIVATED = 'goal_motivated',
  ANXIOUS = 'anxious',
}

export interface EmotionalContext {
  stressLevel: 'low' | 'medium' | 'high';
  impulseRisk: 'low' | 'medium' | 'high';
  emotionalState: EmotionalState;
  confidence: number;
}

@Injectable()
export class EmotionalContextEngine {
  private readonly logger = new Logger(EmotionalContextEngine.name);

  /**
   * Infers emotional financial state using deterministic heuristics.
   */
  async inferEmotionalContext(userId: string, metrics: any, behaviorSignals: any): Promise<EmotionalContext> {
    this.logger.log(`Inferring emotional context for user ${userId}`);

    let emotionalState = EmotionalState.STABLE;
    let stressLevel: 'low' | 'medium' | 'high' = 'low';
    let impulseRisk: 'low' | 'medium' | 'high' = 'low';
    let confidence = 0.7;

    // 1. Detect Stress Spending
    // Heuristic: Rapid repeated food delivery or high volatility in non-essential categories
    if (behaviorSignals.food_delivery_dependency === 'high' && metrics.spendingVolatility > 0.3) {
      emotionalState = EmotionalState.STRESS_SPENDING;
      stressLevel = 'high';
      confidence = 0.85;
    }

    // 2. Detect Impulsive Behavior
    // Heuristic: Late night purchases + weekend spikes
    if (behaviorSignals.late_night_ordering && behaviorSignals.weekend_overspending) {
      emotionalState = EmotionalState.IMPULSIVE;
      impulseRisk = 'high';
      confidence = 0.8;
    }

    // 3. Detect Avoidance
    // Heuristic: No log-ins/transactions during budget deviation periods
    if (metrics.budgetDeviation > 0.15 && metrics.engagementRate < 0.2) {
      emotionalState = EmotionalState.AVOIDANCE;
      stressLevel = 'medium';
      confidence = 0.75;
    }

    return {
      stressLevel,
      impulseRisk,
      emotionalState,
      confidence,
    };
  }
}
