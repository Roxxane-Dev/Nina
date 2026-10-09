import { Injectable, Logger } from '@nestjs/common';

export interface TokenBudget {
  dailyLimit: number;
  currentUsage: number;
  tier: 'free' | 'premium';
}

@Injectable()
export class AICostGovernanceService {
  private readonly logger = new Logger(AICostGovernanceService.name);

  private readonly budgets: Map<string, TokenBudget> = new Map();

  async checkBudget(userId: string, estimatedTokens: number): Promise<boolean> {
    const budget = this.budgets.get(userId) || { dailyLimit: 50000, currentUsage: 0, tier: 'free' };
    
    if (budget.currentUsage + estimatedTokens > budget.dailyLimit) {
      this.logger.warn(`[GOVERNANCE] User ${userId} exceeded token budget.`);
      return false;
    }
    return true;
  }

  async trackUsage(userId: string, tokens: number, provider: string): Promise<void> {
    const budget = this.budgets.get(userId) || { dailyLimit: 50000, currentUsage: 0, tier: 'free' };
    budget.currentUsage += tokens;
    this.budgets.set(userId, budget);
    
    this.logger.debug(`[GOVERNANCE] User ${userId} used ${tokens} tokens on ${provider}. Total: ${budget.currentUsage}`);
  }

  getFallbackProvider(primaryProvider: string): string {
    if (primaryProvider === 'claude') return 'gemini';
    return 'mock';
  }
}
