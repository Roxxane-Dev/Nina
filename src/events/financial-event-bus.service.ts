import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinancialEvent, FinancialEventType } from './event.types';

@Injectable()
export class FinancialEventBusService {
  private readonly logger = new Logger(FinancialEventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publishes a financial intelligence event internally.
   */
  publish<T>(event: FinancialEvent<T>) {
    this.logger.log(`[EVENT PUBLISHED] ${event.type} for user ${event.userId}`);
    this.eventEmitter.emit(event.type, event);
  }

  /**
   * Convenience method to emit an event by type.
   */
  emit(type: FinancialEventType, userId: string, payload: any) {
    this.publish({
      type,
      userId,
      payload,
      timestamp: new Date(),
    });
  }
}
