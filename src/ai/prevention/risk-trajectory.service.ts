import { Injectable, Logger } from '@nestjs/common';

export type TrajectoryState = 'stabilizing' | 'unstable' | 'escalating_risk' | 'critical_pattern' | 'recovering';

@Injectable()
export class RiskTrajectoryService {
  private readonly logger = new Logger(RiskTrajectoryService.name);

  async calculateTrajectory(userId: string, healthHistory: any[]): Promise<TrajectoryState> {
    this.logger.log(`Calculating risk trajectory for ${userId}`);

    // Simplified deterministic trajectory logic
    // Compare current health score vs previous health score
    const current = healthHistory[0]?.overallScore || 0;
    const prev = healthHistory[1]?.overallScore || 0;
    const trend = current - prev;

    if (current < 40 && trend < -5) return 'critical_pattern';
    if (trend < -10) return 'escalating_risk';
    if (trend < 0) return 'unstable';
    if (trend > 5 && current < 70) return 'recovering';
    return 'stabilizing';
  }
}
