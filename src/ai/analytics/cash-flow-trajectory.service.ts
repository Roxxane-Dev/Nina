import { Injectable, Logger } from '@nestjs/common';

export type CashFlowState = 'stable' | 'accelerating_risk' | 'collapsing_runway' | 'recovering' | 'thriving';

@Injectable()
export class CashFlowTrajectoryService {
  private readonly logger = new Logger(CashFlowTrajectoryService.name);

  async calculateTrajectory(userId: string, income: number, expenses: number, balance: number): Promise<any> {
    const burnRate = expenses - income;
    const runwayMonths = burnRate > 0 ? balance / burnRate : Infinity;

    let state: CashFlowState = 'stable';
    if (runwayMonths < 1) state = 'collapsing_runway';
    else if (runwayMonths < 3) state = 'accelerating_risk';
    else if (burnRate < 0) state = 'thriving';

    return {
      state,
      runwayMonths,
      projectedBurnoutDate: burnRate > 0 ? new Date(Date.now() + runwayMonths * 30 * 24 * 60 * 60 * 1000) : null,
      accelerationFactor: 1.1 // Example multiplier for spending growth
    };
  }
}
