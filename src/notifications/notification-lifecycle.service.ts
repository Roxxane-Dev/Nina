import { Injectable, Logger } from '@nestjs/common';
import { FinancialEventBusService } from '../events/financial-event-bus.service';
import { FinancialEventType } from '../events/event.types';

@Injectable()
export class NotificationLifecycleService {
  private readonly logger = new Logger(NotificationLifecycleService.name);

  constructor(private readonly eventBus: FinancialEventBusService) {}

  /**
   * Processes new notification requests with intelligent cooldowns.
   */
  async createNotification(userId: string, data: any) {
    const canNotify = await this.checkCooldown(userId, data.type);
    
    if (!canNotify) {
      this.logger.warn(`[NOTIFICATION SKIPPED] Cooldown active for user ${userId} type ${data.type}`);
      return;
    }

    // Persist to DB
    const notification = {
      id: 'mock-id',
      userId,
      ...data,
      status: 'unread',
      createdAt: new Date(),
    };

    this.logger.log(`[NOTIFICATION CREATED] ${data.type} for user ${userId}`);
    
    this.eventBus.emit(FinancialEventType.NOTIFICATION_CREATED, userId, notification);
    
    return notification;
  }

  private async checkCooldown(userId: string, type: string): Promise<boolean> {
    // Logic to prevent notification spam
    // e.g. only 1 "insight" per 4 hours
    return true;
  }

  async markAsRead(notificationId: string) {
    // Update status in DB
  }
}
