import { Injectable, Logger } from '@nestjs/common';
import { TriggerEvent } from './trigger-engine.service';
import { ProviderRouterService } from '../llm/provider-router.service';
import { EmotionalContext } from '../emotion/emotional-context.engine';

export enum CoachingIntensity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Injectable()
export class CoachingEngineService {
  private readonly logger = new Logger(CoachingEngineService.name);

  constructor(private readonly providerRouter: ProviderRouterService) {}

  /**
   * Generates adaptive coaching messages based on financial state and emotional context.
   */
  async generateCoaching(
    userId: string, 
    triggers: TriggerEvent[], 
    style: string = 'supportive',
    emotion?: EmotionalContext
  ): Promise<string[]> {
    this.logger.log(`Generating adaptive coaching for user ${userId}`);
    const coachingMessages: string[] = [];

    // 1. Determine Intensity
    const intensity = this.calculateIntensity(triggers, emotion);

    for (const trigger of triggers) {
      // 2. Base content logic
      const baseContent = this.getBaseContent(trigger);

      // 3. AI Adaptation for tone and emotion
      // In a production scenario, we'd call the LLM here.
      // Mocking the result for deterministic performance:
      const adapted = this.mockAiAdaptation(baseContent, style, intensity, emotion);
      coachingMessages.push(adapted);
    }

    return coachingMessages;
  }

  private calculateIntensity(triggers: TriggerEvent[], emotion?: EmotionalContext): CoachingIntensity {
    if (triggers.some(t => t.severity === 'high') || emotion?.stressLevel === 'high') {
      return CoachingIntensity.HIGH;
    }
    return CoachingIntensity.LOW;
  }

  private getBaseContent(trigger: TriggerEvent): string {
    return trigger.suggestedAction;
  }

  private mockAiAdaptation(
    content: string, 
    style: string, 
    intensity: CoachingIntensity, 
    emotion?: EmotionalContext
  ): string {
    if (intensity === CoachingIntensity.HIGH) {
      return `Ojo 👀. ${content}. Necesitamos ajustar el rumbo hoy mismo.`;
    }
    
    if (emotion?.emotionalState === 'stress_spending') {
      return `Tranqui 💛. He notado un poco de estrés en tus gastos. ${content}. Vamos con calma.`;
    }

    return `¡Vas muy bien! ${content} 🚀`;
  }
}
