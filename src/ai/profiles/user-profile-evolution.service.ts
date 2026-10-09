import { Injectable, Logger } from '@nestjs/common';
import { UserProfile, BehaviorSignals } from '../context/context-packet';
import { FinancialHealthSnapshot } from '../analytics/financial-health.types';

@Injectable()
export class UserProfileEvolutionService {
  private readonly logger = new Logger(UserProfileEvolutionService.name);

  /**
   * Evolves the user profile over time based on new signals and health metrics.
   */
  async evolveProfile(
    userId: string, 
    currentProfile: UserProfile, 
    signals: BehaviorSignals, 
    health: FinancialHealthSnapshot
  ): Promise<UserProfile> {
    this.logger.log(`Evolving user profile for ${userId} based on new context.`);
    
    const evolvedProfile = { ...currentProfile };

    // Example deterministic evolution rules
    if (signals.stress_spending && health.riskLevel === 'high') {
      evolvedProfile.preferred_coaching_style = 'direct_but_warm';
      evolvedProfile.spending_behavior = 'impulsive';
    }

    if (signals.savings_consistency === 'high' && health.overallScore > 75) {
      evolvedProfile.financial_discipline = 'high';
      evolvedProfile.goal_commitment = 'high';
    }

    // This would then be persisted to PostgreSQL jsonb
    // await this.db.update('profiles', { profile: evolvedProfile }).where({ userId });
    
    this.logger.debug(`[EVOLUTION] Profile updated. New discipline: ${evolvedProfile.financial_discipline}`);

    return evolvedProfile;
  }
}
