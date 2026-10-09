import { Injectable, Logger } from '@nestjs/common';

export interface RelapseRisk {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  matchingPatterns: string[];
  predictedOutcome: string;
  preventionRecommendation: string;
}

@Injectable()
export class RelapseDetectionService {
  private readonly logger = new Logger(RelapseDetectionService.name);

  async detectRelapseRisk(userId: string, currentSignals: any, historicalPatterns: any[]): Promise<RelapseRisk> {
    this.logger.log(`Analyzing relapse risk for user ${userId}`);

    // Deterministic Pattern Matching
    const matchingPatterns: string[] = [];
    let riskScore = 0;

    // 1. Detect Salary-Spike Overspending Pattern
    if (currentSignals.is_salary_week && currentSignals.spending_acceleration === 'high') {
      matchingPatterns.push('salary_spike_overspending');
      riskScore += 40;
    }

    // 2. Detect Late-Night Emotional Purchases
    if (currentSignals.midnight_spending_detected) {
      matchingPatterns.push('emotional_night_spending');
      riskScore += 30;
    }

    // 3. Detect Subscription Reactivation
    if (currentSignals.recent_subscription_reactivation) {
      matchingPatterns.push('behavioral_regression_subscriptions');
      riskScore += 20;
    }

    // 4. Detect Recovery Breakdown
    if (currentSignals.recovery_phase === 'early' && currentSignals.high_volatility) {
      matchingPatterns.push('fragile_recovery_interruption');
      riskScore += 50;
    }

    const riskLevel = this._mapScoreToLevel(riskScore);

    return {
      riskLevel,
      confidence: 0.85,
      matchingPatterns,
      predictedOutcome: riskLevel === 'high' ? 'Possible depletion of savings buffer within 7 days.' : 'Stable trajectory.',
      preventionRecommendation: this._getRecommendation(riskLevel),
    };
  }

  private _mapScoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  private _getRecommendation(level: string): string {
    switch (level) {
      case 'critical': return 'Enable emergency spending lock or set strict daily limits.';
      case 'high': return 'Review essential spending and pause non-critical subscriptions.';
      case 'medium': return 'Stay mindful of your recovery momentum. Avoid browsing retail apps.';
      default: return 'Maintain current discipline.';
    }
  }
}
