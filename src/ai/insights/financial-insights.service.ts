import { Injectable, Logger } from '@nestjs/common';
import { FinancialAnalyticsService } from '../analytics/financial-analytics.service';
import { ContextPacket } from '../context/context-packet';

@Injectable()
export class FinancialInsightsEngine {
  private readonly logger = new Logger(FinancialInsightsEngine.name);

  constructor(
    private readonly analyticsService: FinancialAnalyticsService,
  ) {}

  /**
   * Generates deterministic insights to be fed into the ContextPacket.
   */
  async generateInsights(userId: string): Promise<string[]> {
    this.logger.log(`Generating deterministic insights for user ${userId}`);
    const insights: string[] = [];

    const metrics = await this.analyticsService.calculateMetrics(userId);

    if (metrics.trend === 'up') {
      insights.push(`El ritmo de gasto está acelerando. Proyección de fin de mes: $${metrics.forecast_end_of_month.toFixed(2)}`);
    }

    if (metrics.budget_status.over_budget) {
      insights.push(`¡Alerta! El usuario está proyectado para pasarse de su presupuesto mensual.`);
    } else {
      insights.push(`El usuario tiene $${metrics.budget_status.remaining.toFixed(2)} restantes en su presupuesto.`);
    }

    return insights;
  }
}
