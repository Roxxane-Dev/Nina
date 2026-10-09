import { Injectable, Logger } from '@nestjs/common';
import { FinancialHealthService } from '../analytics/financial-health.service';

export interface RiskProfile {
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recommendations: string[];
}

@Injectable()
export class RiskMonitorService {
  private readonly logger = new Logger(RiskMonitorService.name);

  constructor(private readonly healthService: FinancialHealthService) {}

  /**
   * Evaluates financial and behavioral risk levels.
   */
  async evaluateRisk(userId: string): Promise<RiskProfile> {
    this.logger.log(`Monitoring financial risk for user ${userId}`);

    const health = await this.healthService.calculateHealthScore(userId);
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Deterministic Risk Assessment
    if (health.overallScore < 50) {
      riskLevel = 'high';
      riskFactors.push('low_savings_ratio', 'high_expense_volatility');
      recommendations.push('Freeze discretionary spending immediately.');
    } else if (health.overallScore < 75) {
      riskLevel = 'medium';
      riskFactors.push('inconsistent_cashflow');
      recommendations.push('Monitor upcoming recurring bills.');
    } else {
      riskLevel = 'low';
      recommendations.push('Maintain current savings cadence.');
    }

    return {
      riskLevel,
      riskFactors,
      recommendations
    };
  }
}
