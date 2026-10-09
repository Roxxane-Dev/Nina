import { Injectable, Logger } from '@nestjs/common';
// import { SupabaseClient } from '@supabase/supabase-js'; // Fixed import if needed later

export type StreakType = 'no_impulsive_spending' | 'savings' | 'budget_consistency' | 'recovery';

@Injectable()
export class StreakEngineService {
  private readonly logger = new Logger(StreakEngineService.name);

  // In a real app, this would inject a DB service or Supabase client
  // For now, we'll implement the logic and mock the persistence

  async updateStreaks(userId: string, signals: any): Promise<any[]> {
    this.logger.log(`Evaluating streaks for user ${userId}`);
    
    // 1. Logic for No Impulsive Spending Streak
    const isImpulsive = signals.stress_spending || signals.weekend_overspending;
    await this._processStreak(userId, 'no_impulsive_spending', !isImpulsive);

    // 2. Logic for Savings Streak
    const isSaving = signals.savings_consistency === 'high';
    await this._processStreak(userId, 'savings', isSaving);

    // 3. Logic for Recovery Streak
    const isRecovering = signals.recovery_detected === true;
    await this._processStreak(userId, 'recovery', isRecovering);

    // Return current active streaks
    return [
      { type: 'no_impulsive_spending', length: 5, status: 'active' },
      { type: 'savings', length: 12, status: 'active' },
    ];
  }

  private async _processStreak(userId: string, type: StreakType, increment: boolean) {
    if (increment) {
      this.logger.debug(`[STREAK] Incrementing ${type} for ${userId}`);
      // DB: UPSERT streak SET current_length = current_length + 1, last_event_at = NOW()
    } else {
      this.logger.debug(`[STREAK] Breaking ${type} for ${userId}`);
      // DB: UPDATE streak SET current_length = 0, status = 'broken'
    }
  }
}
