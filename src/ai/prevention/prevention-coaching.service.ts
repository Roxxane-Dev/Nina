import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PreventionCoachingService {
  private readonly logger = new Logger(PreventionCoachingService.name);

  async generatePreventionMessage(userId: string, relapseRisk: any, trajectory: string): Promise<string> {
    if (relapseRisk.riskLevel === 'low') return 'Tu estabilidad es sólida hoy. Mantén el enfoque en tus metas.';

    if (trajectory === 'escalating_risk') {
      return 'Estás entrando en un patrón de aceleración de gasto similar a semanas de alto estrés anteriores. Respira profundo hoy 💛';
    }

    if (relapseRisk.riskLevel === 'high' || relapseRisk.riskLevel === 'critical') {
      return 'Históricamente, este es un periodo de alto riesgo para ti. Tu ritmo de recuperación es fuerte, protégelo evitando compras no planificadas hoy.';
    }

    return 'Tómalo con calma. Tu inercia de recuperación sigue siendo tu mejor activo.';
  }
}
