import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryModule } from '../memory/memory.module';
import { FinancialLedgerModule } from '../financial-ledger/financial-ledger.module';

// LLM Providers
import { AIOrchestratorService } from './orchestrator/ai-orchestrator.service';
import { ProviderRouterService } from './llm/provider-router.service';
import { GeminiProvider } from './llm/gemini.provider';
import { ClaudeProvider } from './llm/claude.provider';
import { OpenAIProvider } from './llm/openai.provider';
import { MockProvider } from './providers/mock.provider';
import { ClaudeProvider as OldClaudeProvider } from './providers/claude.provider';
import { GeminiProvider as OldGeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider as OldOpenAIProvider } from './providers/openai.provider';
import { AIService } from './ai.service';

// Memory
import { MemoryDecayService } from './memory/memory-decay.service';
import { LongTermMemoryService } from './memory/long-term-memory.service';
import { MemoryRankingService } from './memory/memory-ranking.service';

// Analytics
import { FinancialAnalyticsService } from './analytics/financial-analytics.service';
import { FinancialHealthService } from './analytics/financial-health.service';
import { FinancialHealthV2Service } from './analytics/financial-health-v2.service';
import { CashFlowTrajectoryService } from './analytics/cash-flow-trajectory.service';

// Profiles
import { BehaviorSignalsService } from './profiles/behavior-signals.service';
import { UserProfileEvolutionService } from './profiles/user-profile-evolution.service';
import { OnboardingService } from './profiles/onboarding.service';

// RAG & Insights
import { CustomRAGService } from './rag/rag.service';
import { FinancialInsightsEngine } from './insights/financial-insights.service';

// Proactive
import { TriggerEngineService } from './proactive/trigger-engine.service';
import { RiskMonitorService } from './proactive/risk-monitor.service';
import { CoachingEngineService } from './proactive/coaching-engine.service';
import { NotificationEngineService } from './proactive/notification-engine.service';
import { ProactiveEngineService } from './proactive/proactive-engine.service';

// Emotion
import { EmotionalContextEngine } from './emotion/emotional-context.engine';

// Behavioral
import { StreakEngineService } from './behavioral/streak-engine.service';
import { ReinforcementEngineService } from './behavioral/reinforcement-engine.service';
import { RecoveryEngineService } from './behavioral/recovery-engine.service';
import { AdaptiveNudgesService } from './behavioral/adaptive-nudges.service';
import { LifeStageIntelligenceService, FinancialIdentityService } from './behavioral/life-stage.service';
import { InterventionEngine, MultiPersonaCoachingService } from './behavioral/intervention-engine.service';

// Prevention
import { RelapseDetectionService } from './prevention/relapse-detection.service';
import { RiskTrajectoryService } from './prevention/risk-trajectory.service';
import { BehavioralRegressionService } from './prevention/behavioral-regression.service';
import { PredictiveSignalsService } from './prevention/predictive-signals.service';
import { PreventionCoachingService } from './prevention/prevention-coaching.service';

// Social
import { HouseholdIntelligenceService, CollaborativeRiskEngine } from './social/household-intelligence.service';

// Observability & Governance
import { AIObservabilityService } from './observability/ai-observability.service';
import { SystemHealthService } from './observability/system-health.service';
import { AICostGovernanceService } from './governance/ai-cost-governance.service';
import { FeatureFlagService } from './governance/feature-flag.service';

// Context
import { ContextPacketValidator } from './context/context-packet-validator';

// External Adapters
import { BankingAdapterService } from '../connectors/normalized-banking-layer';
import { InvoiceParsingService } from '../sunat/invoice-parsing';
import { ProductAnalyticsService } from '../analytics/product-analytics.service';

// ─── All providers owned by AIModule ───────────────────────────────────────
const AI_PROVIDERS = [
  // Legacy compatibility
  AIService,
  MockProvider,
  OldClaudeProvider,
  OldGeminiProvider,
  OldOpenAIProvider,

  // LLM routing
  GeminiProvider,
  ClaudeProvider,
  OpenAIProvider,
  ProviderRouterService,
  AIOrchestratorService,

  // Memory
  MemoryDecayService,
  MemoryRankingService,
  LongTermMemoryService,

  // Analytics
  FinancialAnalyticsService,
  FinancialHealthService,
  FinancialHealthV2Service,
  CashFlowTrajectoryService,

  // Profiles
  BehaviorSignalsService,
  UserProfileEvolutionService,
  OnboardingService,

  // RAG & Insights
  CustomRAGService,
  FinancialInsightsEngine,

  // Proactive
  TriggerEngineService,
  RiskMonitorService,
  CoachingEngineService,
  NotificationEngineService,
  ProactiveEngineService,

  // Emotion
  EmotionalContextEngine,

  // Behavioral
  StreakEngineService,
  ReinforcementEngineService,
  RecoveryEngineService,
  AdaptiveNudgesService,
  LifeStageIntelligenceService,
  FinancialIdentityService,
  InterventionEngine,
  MultiPersonaCoachingService,

  // Prevention
  RelapseDetectionService,
  RiskTrajectoryService,
  BehavioralRegressionService,
  PredictiveSignalsService,
  PreventionCoachingService,

  // Social
  HouseholdIntelligenceService,
  CollaborativeRiskEngine,

  // Observability & Governance
  AIObservabilityService,
  SystemHealthService,
  AICostGovernanceService,
  FeatureFlagService,

  // Context
  ContextPacketValidator,

  // External Adapters
  BankingAdapterService,
  InvoiceParsingService,
  ProductAnalyticsService,
];

@Module({
  imports: [ConfigModule, MemoryModule, FinancialLedgerModule],
  providers: AI_PROVIDERS,
  exports: AI_PROVIDERS, // Export everything so JobsModule, HomeModule, ChatModule can consume freely
})
export class AIModule {
  private readonly logger = new Logger('AIModule');
  constructor() {
    this.logger.log('[MODULE READY] AIModule initialized');
  }
}
