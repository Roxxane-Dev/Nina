import { Injectable, Logger } from '@nestjs/common';

export interface OnboardingData {
  salaryRange: string;
  savingsGoals: string[];
  stressLevel: number;
  financialPersonality: string;
  householdStatus: string;
  coachingTone: string;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  async processOnboarding(userId: string, data: OnboardingData): Promise<any> {
    this.logger.log(`[ONBOARDING] Initializing user ${userId}`);
    
    const initialProfile = {
      risk_tolerance: 'medium',
      spending_behavior: data.financialPersonality,
      tone_preference: data.coachingTone,
      financial_goal: data.savingsGoals[0] || 'stabilization',
      monthly_spending: 0,
      stress_spending_pattern: data.stressLevel > 0.6,
    };

    // Initialize memory with onboarding context
    // Persist profile to DB
    
    return initialProfile;
  }
}
