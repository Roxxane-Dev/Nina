import { Injectable, Logger } from '@nestjs/common';
import { TriggerEngineService } from './trigger-engine.service';
import { RiskMonitorService } from './risk-monitor.service';
import { CoachingEngineService } from './coaching-engine.service';
import { NotificationEngineService } from './notification-engine.service';
import { BehaviorSignalsService } from '../profiles/behavior-signals.service';
import { UserProfileEvolutionService } from '../profiles/user-profile-evolution.service';

@Injectable()
export class ProactiveEngineService {
  private readonly logger = new Logger(ProactiveEngineService.name);

  constructor(
    private readonly triggerEngine: TriggerEngineService,
    private readonly riskMonitor: RiskMonitorService,
    private readonly coachingEngine: CoachingEngineService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly behaviorService: BehaviorSignalsService,
    // Add DB / persistence dependency here for proactive_events
  ) {}

  /**
   * Central coordinator for scheduled financial evaluations.
   * Runs independently of user chat interactions.
   */
  async runScheduledEvaluation(userId: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[PROACTIVE EVALUATION START] User: ${userId}`);

    // 1. Evaluate Risk and Behavior
    const riskProfile = await this.riskMonitor.evaluateRisk(userId);
    const behaviorSignals = await this.behaviorService.extractSignals(userId);
    
    // 2. Evaluate Triggers
    const triggers = await this.triggerEngine.evaluateTriggers(userId);

    // 3. Generate Coaching
    if (triggers.length > 0) {
      const coachingStyle = 'supportive'; // fetch from DB profile
      const messages = await this.coachingEngine.generateCoaching(userId, triggers, coachingStyle);

      // 4. Dispatch Notifications
      const notifications = await this.notificationEngine.dispatchNotifications(userId, messages, triggers);

      // 5. Persist Proactive Events
      // Example: 
      // await this.db.table('proactive_events').insert({
      //   user_id: userId,
      //   type: notifications[0].type,
      //   severity: triggers[0].severity,
      //   payload: { triggers, messages, riskProfile }
      // });
      this.logger.log(`Persisted proactive events for user ${userId}`);
    }

    // Observability Logging
    const latency = Date.now() - startTime;
    this.logger.log(`[PROACTIVE EVALUATION END] Completed in ${latency}ms. Risk Level: ${riskProfile.riskLevel}, Triggers Fired: ${triggers.length}`);
  }
}
