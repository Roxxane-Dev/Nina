import { Injectable, Logger } from '@nestjs/common';

export interface Nudge {
  id: string;
  type: 'action' | 'reflection' | 'encouragement';
  content: string;
  priority: number;
}

@Injectable()
export class AdaptiveNudgesService {
  private readonly logger = new Logger(AdaptiveNudgesService.name);

  async generateNudges(userId: string, context: any): Promise<Nudge[]> {
    const nudges: Nudge[] = [];
    const { health, emotionalState, streaks } = context;

    // 1. Stress-aware nudges
    if (emotionalState === 'stressed') {
      nudges.push({
        id: 'nudge_1',
        type: 'reflection',
        content: 'Hoy prioriza solo lo esencial. Mañana será otro día.',
        priority: 10,
      });
      return nudges; // In stress, we don't overwhelm with more nudges
    }

    // 2. Thriving nudges
    if (health.overallScore > 80) {
      nudges.push({
        id: 'nudge_2',
        type: 'action',
        content: 'Vas increíble. ¿Qué tal si asignas S/50 extra a tu meta de ahorro?',
        priority: 5,
      });
    }

    // 3. Recovery nudges
    if (health.isRecovering) {
      nudges.push({
        id: 'nudge_3',
        type: 'encouragement',
        content: 'Mantén este ritmo. Estás a 2 días de completar tu racha de recuperación.',
        priority: 8,
      });
    }

    return nudges;
  }
}
