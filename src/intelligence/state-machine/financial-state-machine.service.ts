import { Injectable, Logger } from '@nestjs/common';
import { FinancialEventBusService } from '../../events/financial-event-bus.service';
import { FinancialEventType } from '../../events/event.types';

export enum FinancialState {
  STABLE = 'stable',
  RISKY = 'risky',
  OVERSPENDING = 'overspending',
  IMPROVING = 'improving',
  RECOVERING = 'recovering',
  GOAL_FOCUSED = 'goal_focused',
  STRESSED = 'financially_stressed',
}

@Injectable()
export class FinancialStateMachineService {
  private readonly logger = new Logger(FinancialStateMachineService.name);

  constructor(private readonly eventBus: FinancialEventBusService) {}

  /**
   * Deterministically calculates the next state for a user.
   */
  async evaluateStateTransition(userId: string, currentMetrics: any): Promise<FinancialState> {
    const previousState = await this.getCurrentState(userId);
    let newState = previousState;

    // Deterministic Logic
    if (currentMetrics.budgetDeviation > 0.2) {
      newState = FinancialState.OVERSPENDING;
    } else if (currentMetrics.riskScore > 70) {
      newState = FinancialState.RISKY;
    } else if (currentMetrics.savingsVelocity > 0.1 && previousState === FinancialState.OVERSPENDING) {
      newState = FinancialState.RECOVERING;
    } else if (currentMetrics.healthScore > 80) {
      newState = FinancialState.STABLE;
    }

    if (newState !== previousState) {
      this.logger.log(`[STATE TRANSITION] User ${userId}: ${previousState} -> ${newState}`);
      await this.persistState(userId, newState);
      
      this.eventBus.emit(FinancialEventType.HEALTH_CHANGED, userId, { 
        previousState, 
        newState,
        timestamp: new Date()
      });
    }

    return newState;
  }

  private async getCurrentState(userId: string): Promise<FinancialState> {
    // Mock: fetch from DB
    return FinancialState.STABLE;
  }

  private async persistState(userId: string, state: FinancialState) {
    // Mock: update user_profiles.financial_state
  }
}
