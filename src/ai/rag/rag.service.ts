import { Injectable, Logger } from '@nestjs/common';
import { LongTermMemoryService } from '../memory/long-term-memory.service';
import { FinancialAnalyticsService } from '../analytics/financial-analytics.service';
import { BehaviorSignalsService } from '../profiles/behavior-signals.service';
import { FinancialHealthService } from '../analytics/financial-health.service';
import { UserProfileEvolutionService } from '../profiles/user-profile-evolution.service';
import { ContextPacket } from '../context/context-packet';
import { ScoredMemory } from '../memory/memory.types';

@Injectable()
export class CustomRAGService {
  private readonly logger = new Logger(CustomRAGService.name);

  constructor(
    private readonly memoryService: LongTermMemoryService,
    private readonly analyticsService: FinancialAnalyticsService,
    private readonly behaviorService: BehaviorSignalsService,
    private readonly healthService: FinancialHealthService,
    private readonly profileEvolutionService: UserProfileEvolutionService,
  ) {}

  /**
   * Assembles the ContextPacket dynamically.
   * Priority order:
   * 1. active goals
   * 2. financial anomalies
   * 3. recent financial behavior
   * 4. emotional signals
   * 5. recent conversations
   * 6. generic memories
   */
  async assembleContext(userId: string, currentMessage: string, isPremium: boolean = false): Promise<ContextPacket> {
    const startTime = Date.now();
    this.logger.log(`[RAG START] Assembling context for user ${userId}. Premium: ${isPremium}`);

    // Token budgeting
    const maxTokens = isPremium ? 4000 : 1000;
    this.logger.log(`[TOKEN BUDGET] Limit set to ${maxTokens} tokens.`);

    // 1. & 2. Deterministic retrieval (Goals & Anomalies & Financial Metrics)
    const financialMetrics = await this.analyticsService.calculateMetrics(userId);
    const anomalies = await this.analyticsService.detectAnomalies(userId);
    const goals: any[] = []; // fetch from DB

    // Phase 2.5 retrievals
    const behaviorSignals = await this.behaviorService.extractSignals(userId);
    const financialHealth = await this.healthService.calculateHealthScore(userId);
    
    // In a real scenario, fetch currentProfile from DB
    const mockProfile: any = {}; 
    const evolvedProfile = await this.profileEvolutionService.evolveProfile(userId, mockProfile, behaviorSignals, financialHealth);

    // Retrieve semantic memories and rank them (which already considers recency & importance)
    // We pass the maxTokens to longTermMemory, which passes it to the ranking service
    const memories: ScoredMemory[] = await this.memoryService.retrieveRelevantMemories(
      userId, 
      currentMessage, 
      maxTokens
    );

    // Filter by types to respect priority logging (though the ranker handled the trimming)
    const activeGoals = memories.filter(m => m.type === 'goal');
    const emotionalSignalsMem = memories.filter(m => m.type === 'emotional');
    const recentConversations = memories.filter(m => m.type === 'conversation');
    
    // Convert emotional signals to string array for the packet
    const emotionalSignals = emotionalSignalsMem.map(m => m.content);

    // Observability Logging
    const latencyMs = Date.now() - startTime;
    this.logger.log(`[RAG END] Assembled context in ${latencyMs}ms. Token budget: ${maxTokens}. Graph Latency: ${latencyMs}ms`);
    this.logger.debug(`[RAG STATS] Goals: ${activeGoals.length} | Anomalies: ${anomalies.length} | Emotional: ${emotionalSignals.length} | Conversations: ${recentConversations.length}`);
    this.logger.debug(`[RAG SIGNALS] Health: ${financialHealth.overallScore} | Behavior Risks: ${behaviorSignals.stress_spending}`);

    return {
      userId,
      currentMessage,
      memories,
      recentExpenses: [], // fetch from DB
      userProfile: evolvedProfile,
      goals,
      anomalies,
      financialMetrics,
      emotionalSignals,
      activeSubscriptions: [],
      insights: [], // deterministic insights
      
      // Phase 2.5 Extensions
      behaviorSignals,
      financialHealth,
      activeRisks: [],
      coachingStyle: evolvedProfile.preferred_coaching_style
    };
  }
}
