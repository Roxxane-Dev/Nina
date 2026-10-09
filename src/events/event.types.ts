export enum FinancialEventType {
  EXPENSE_CREATED = 'expense.created',
  GOAL_UPDATED = 'goal.updated',
  HEALTH_CHANGED = 'health.changed',
  SIGNAL_DETECTED = 'signal.detected',
  TRIGGER_DETECTED = 'trigger.detected',
  COACHING_GENERATED = 'coaching.generated',
  NOTIFICATION_CREATED = 'notification.created',
}

export interface FinancialEvent<T = any> {
  type: FinancialEventType;
  userId: string;
  payload: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}
