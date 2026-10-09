import { Injectable, Logger } from '@nestjs/common';

export interface ReinforcementMoment {
  type: string;
  title: string;
  message: string;
  intensity: 'low' | 'medium' | 'high';
  timestamp: string;
}

@Injectable()
export class ReinforcementEngineService {
  private readonly logger = new Logger(ReinforcementEngineService.name);

  async detectReinforcementMoments(
    userId: string, 
    currentHealth: any, 
    prevHealth: any, 
    signals: any
  ): Promise<ReinforcementMoment[]> {
    const moments: ReinforcementMoment[] = [];

    // 1. Detect Recovery
    if (currentHealth.overallScore > prevHealth.overallScore && prevHealth.riskLevel === 'high') {
      moments.push({
        type: 'recovery_detected',
        title: '¡Recuperación Detectada!',
        message: 'Has logrado estabilizar tus finanzas después de una semana difícil. ¡Gran trabajo!',
        intensity: 'high',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Detect Spending Control
    if (signals.spending_acceleration === 'slowing' && signals.overspending === false) {
      moments.push({
        type: 'spending_control_improved',
        title: 'Ritmo bajo control',
        message: 'Tu velocidad de gasto ha disminuido. Estás siendo más consciente.',
        intensity: 'medium',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Detect Subscription Cleanup
    if (signals.subscription_cancelled) {
      moments.push({
        type: 'subscription_cleanup',
        title: 'Limpieza de suscripciones',
        message: 'Eliminar lo que no usas es un hábito de alto nivel.',
        intensity: 'low',
        timestamp: new Date().toISOString(),
      });
    }

    return moments;
  }
}
