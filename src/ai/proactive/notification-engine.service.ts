import { Injectable, Logger } from '@nestjs/common';
import { TriggerEvent } from './trigger-engine.service';

export interface NotificationPayload {
  type: 'insight' | 'warning' | 'goal' | 'anomaly' | 'encouragement';
  urgency: 'low' | 'medium' | 'high';
  message: string;
  metadata: any;
}

@Injectable()
export class NotificationEngineService {
  private readonly logger = new Logger(NotificationEngineService.name);

  /**
   * Prioritizes notifications and manages cooldowns to avoid spam.
   */
  async dispatchNotifications(userId: string, messages: string[], triggers: TriggerEvent[]): Promise<NotificationPayload[]> {
    this.logger.log(`Prioritizing and dispatching notifications for user ${userId}`);

    const dispatched: NotificationPayload[] = [];

    // Filter out spam using cooldown logic (mocked here, check DB for last notified time)
    const canNotify = true; 

    if (canNotify && messages.length > 0) {
      // We take the highest severity trigger to determine notification type
      const hasHighSeverity = triggers.some(t => t.severity === 'high' || t.severity === 'critical');
      
      dispatched.push({
        type: hasHighSeverity ? 'warning' : 'insight',
        urgency: hasHighSeverity ? 'high' : 'medium',
        message: messages[0], // Send the most important one
        metadata: { triggerCount: triggers.length }
      });
      
      this.logger.log(`Dispatched notification: [${dispatched[0].urgency}] ${dispatched[0].message}`);
    } else {
      this.logger.log(`Notification skipped due to cooldown or zero messages.`);
    }

    // Future: Push notification API call, WhatsApp, etc.
    return dispatched;
  }
}
