import { Injectable, Logger } from '@nestjs/common';

export enum AnalyticsEventType {
  COACHING_OPENED = 'coaching_opened',
  PREVENTION_CARD_CLICKED = 'prevention_card_clicked',
  STREAK_COMPLETED = 'streak_completed',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  INSIGHT_DISMISSED = 'insight_dismissed',
  DASHBOARD_OPENED = 'dashboard_opened',
  REALTIME_ALERT_RECEIVED = 'realtime_alert_received',
}

@Injectable()
export class ProductAnalyticsService {
  private readonly logger = new Logger(ProductAnalyticsService.name);

  async trackEvent(userId: string, event: AnalyticsEventType, metadata: any = {}): Promise<void> {
    this.logger.log(`[ANALYTICS] User: ${userId} | Event: ${event} | Metadata: ${JSON.stringify(metadata)}`);
    // Persist to database (analytics_events table)
  }

  async getEngagementMetrics(userId: string): Promise<any> {
    // Calculate DAU/WAU proxy from events
    return {
      sessionCount: 12,
      lastActive: new Date(),
    };
  }
}
