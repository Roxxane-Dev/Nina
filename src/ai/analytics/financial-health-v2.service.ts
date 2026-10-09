import { Injectable, Logger } from '@nestjs/common';
import { 
  FinancialHealthSnapshot, 
  IncomeStability, 
  ExpenseVolatility, 
  SubscriptionBurden, 
  BehavioralRisk, 
  EmergencyRunway, 
  FinancialForecast 
} from './financial-health.types';
import { RecurringIncomeService } from '../../recurring-income/recurring-income.service';
import { SubscriptionIntelligenceService } from '../../subscriptions/subscription-intelligence.service';
import { EmotionalContextEngine, EmotionalState } from '../emotion/emotional-context.engine';

@Injectable()
export class FinancialHealthV2Service {
  private readonly logger = new Logger(FinancialHealthV2Service.name);

  constructor(
    private readonly incomeService: RecurringIncomeService,
    private readonly subscriptionService: SubscriptionIntelligenceService,
    private readonly emotionEngine: EmotionalContextEngine,
  ) {}

  /**
   * Computes a holistic financial health snapshot using deterministic logic.
   */
  async computeHealth(userId: string, transactions: any[], metrics: any): Promise<FinancialHealthSnapshot> {
    this.logger.log(`[HEALTH V2] Computing health for user ${userId}`);

    const incomeProfile = this.incomeService.analyzeIncome(transactions);
    const subscriptions = this.subscriptionService.detectSubscriptions(transactions);
    const emotionalContext = await this.emotionEngine.inferEmotionalContext(userId, metrics, {});

    // 1. Income Stability
    const incomeStability: IncomeStability = {
      score: incomeProfile.isStable ? 90 : 40,
      type: incomeProfile.isStable ? 'stable' : 'irregular',
      monthlyAverage: incomeProfile.monthlyAverage,
      confidence: 0.85,
      nextExpectedDate: incomeProfile.nextExpectedDate,
    };

    // 2. Volatility
    const volatility: ExpenseVolatility = {
      level: metrics.spendingVolatility > 0.2 ? 'high' : 'low',
      standardDeviation: metrics.spendingVolatility,
      unusualSpikesCount: metrics.anomaliesCount || 0,
      riskImpact: metrics.spendingVolatility * 100,
    };

    // 3. Subscription Burden
    const totalSubCost = subscriptions.reduce((acc, s) => acc + s.monthlyAmount, 0);
    const subPercentage = incomeProfile.monthlyAverage > 0 ? (totalSubCost / incomeProfile.monthlyAverage) * 100 : 0;
    const subscriptionBurden: SubscriptionBurden = {
      score: 100 - Math.min(subPercentage * 2, 100),
      percentageOfIncome: subPercentage,
      count: subscriptions.length,
      optimizationOpportunities: subPercentage > 15 ? ['Consider cancelling unused services'] : [],
    };

    // 4. Behavioral Risk
    const behavioralRisk: BehavioralRisk = {
      score: 100 - (emotionalContext.stressLevel === 'high' ? 40 : 0) - (emotionalContext.impulseRisk === 'high' ? 30 : 0),
      activeRisks: emotionalContext.emotionalState !== EmotionalState.STABLE ? [emotionalContext.emotionalState] : [],
      disciplineTrend: 'stable',
    };

    // 5. Emergency Runway
    const avgSpending = metrics.averageMonthlySpending || 1000;
    const months = metrics.totalBalance / avgSpending;
    const emergencyRunway: EmergencyRunway = {
      months,
      riskLevel: months < 1 ? 'critical' : months < 3 ? 'warning' : 'safe',
    };

    // 6. Forecasts
    const forecasts: FinancialForecast = {
      projectedEndOfMonthBalance: metrics.totalBalance - metrics.currentMonthSpending,
      projectedSavings: Math.max(0, incomeProfile.monthlyAverage - avgSpending),
      overspendingRisk: metrics.budgetDeviation > 0.1 ? 'high' : 'low',
    };

    // 7. Overall Score (Weighted)
    const overallScore = Math.round(
      (incomeStability.score * 0.2) +
      (volatility.riskImpact * -0.2 + 100 * 0.2) + // Inverse volatility
      (subscriptionBurden.score * 0.2) +
      (behavioralRisk.score * 0.2) +
      (emergencyRunway.riskLevel === 'safe' ? 20 : 0)
    );

    return {
      userId,
      overallScore,
      riskLevel: overallScore > 75 ? 'low' : overallScore > 50 ? 'medium' : 'high',
      incomeStability,
      volatility,
      subscriptionBurden,
      behavioralRisk,
      emergencyRunway,
      forecasts,
      generatedAt: new Date(),
    };
  }

  /**
   * Generates deterministic recommendations based on health components.
   */
  generateRecommendations(health: FinancialHealthSnapshot): string[] {
    const recommendations: string[] = [];
    
    if (health.subscriptionBurden.percentageOfIncome > 10) {
      recommendations.push(`Tus suscripciones consumen el ${health.subscriptionBurden.percentageOfIncome.toFixed(1)}% de tus ingresos.`);
    }
    
    if (health.emergencyRunway.months < 3) {
      recommendations.push(`Tienes ${health.emergencyRunway.months.toFixed(1)} meses de reserva. Lo ideal son 3-6.`);
    }

    if (health.volatility.level === 'high') {
      recommendations.push(`Tu gasto ha sido muy volátil este mes. Ojo con las compras impulsivas.`);
    }

    return recommendations;
  }
}
