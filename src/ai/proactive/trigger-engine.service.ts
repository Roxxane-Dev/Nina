import { Injectable, Logger } from '@nestjs/common';
import { FinancialAnalyticsService } from '../analytics/financial-analytics.service';

export interface TriggerEvent {
  triggerType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  metadata: Record<string, any>;
  suggestedAction: string;
}

@Injectable()
export class TriggerEngineService {
  private readonly logger = new Logger(TriggerEngineService.name);

  constructor(private readonly analyticsService: FinancialAnalyticsService) {}

  /**
   * Deterministically evaluates conditions to generate proactive triggers.
   */
  async evaluateTriggers(userId: string): Promise<TriggerEvent[]> {
    this.logger.log(`Evaluating proactive triggers for user ${userId}`);
    const triggers: TriggerEvent[] = [];

    // Mock data fetching
    const metrics = await this.analyticsService.calculateMetrics(userId);
    const anomalies = await this.analyticsService.detectAnomalies(userId);

    // 1. Overspending Spike
    if (metrics.budget_status.over_budget) {
      triggers.push({
        triggerType: 'overspending_spike',
        severity: 'high',
        confidence: 0.95,
        metadata: { forecast: metrics.forecast_end_of_month, limit: 2000 },
        suggestedAction: 'Pause non-essential spending until next week.'
      });
    }

    // 2. Goal Deviation (Mock logic)
    const isGoalDeviating = false; // Example
    if (isGoalDeviating) {
      triggers.push({
        triggerType: 'goal_deviation',
        severity: 'medium',
        confidence: 0.8,
        metadata: { goal: 'Berlin Trip', gap: 150 },
        suggestedAction: 'Reallocate $50 from dining out to savings.'
      });
    }

    // 3. Anomalies map to triggers
    if (anomalies.length > 0) {
      triggers.push({
        triggerType: 'unusual_spending_pattern',
        severity: 'medium',
        confidence: 0.85,
        metadata: { anomalies },
        suggestedAction: 'Review recent unusual transactions.'
      });
    }

    this.logger.log(`Generated ${triggers.length} triggers for user ${userId}`);
    return triggers;
  }
}
