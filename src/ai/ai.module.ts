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
import { CashFlowTrajectoryService } from './analytics/cash-flow-trajectory.service';

// Profiles

// Insights
import { FinancialInsightsEngine } from './insights/financial-insights.service';

// Proactive

// Emotion

// Behavioral

// Prevention

// Social

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
  CashFlowTrajectoryService,

  // Insights
  FinancialInsightsEngine,

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
