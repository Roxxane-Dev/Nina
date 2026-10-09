import { Injectable, Logger } from '@nestjs/common';

export type CoachingPersona = 'supportive' | 'analytical' | 'disciplined' | 'calming' | 'motivational' | 'protective';

@Injectable()
export class InterventionEngine {
  async determineInterventionTiming(userId: string, emotionalContext: any): Promise<boolean> {
    // Avoid stress peaks
    if (emotionalContext.stressLevel > 0.8) return false;
    return true;
  }
}

@Injectable()
export class MultiPersonaCoachingService {
  async selectPersona(context: any): Promise<CoachingPersona> {
    if (context.riskLevel === 'high') return 'protective';
    if (context.emotionalState === 'stressed') return 'calming';
    if (context.isRecovering) return 'supportive';
    return 'motivational';
  }
}
