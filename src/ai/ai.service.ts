import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AIInput, AIProviderName } from './ai.types'
import { mergeMemories } from './memory-utils'
import { ClaudeProvider } from './providers/claude.provider'
import { MockProvider } from './providers/mock.provider'
import { GeminiProvider } from './providers/gemini.provider'
import { OpenAIProvider } from './providers/openai.provider'
import { MemoryService } from '../memory/memory.service'

/**
 * Options for a single chat turn. `provider` overrides the global `AI_PROVIDER` env.
 * When `userId` is set, relevant memories are loaded before the LLM call and the exchange
 * is persisted after (unless `persistConversation` is false).
 */
export type ProcessMessageOptions = {
  provider?: string
  userId?: string
  /**
   * When false, skips Supabase writes even if `userId` is provided.
   * Default: true when `userId` is set.
   */
  persistConversation?: boolean
  /**
   * When false, past conversation memories are not injected into the prompt.
   * The grounded chat sets this so only engine facts reach the LLM.
   */
  useMemory?: boolean
}

const PROVIDER_COOLDOWN_MS = 10 * 60 * 1000

/** 401/402/403/404: invalid key, no credit, no access or retired model. */
export function isPermanentProviderError(err: unknown): boolean {
  const e = err as { status?: number; message?: string }
  if (typeof e?.status === "number") return [401, 402, 403, 404].includes(e.status)
  // Gemini SDK puts the status in the message: "[402 Payment Required]".
  return /\[(401|402|403|404)[ \]]/.test(String(e?.message ?? ''))
}

const PROVIDER_KEYS: Record<Exclude<AIProviderName, 'mock'>, string> = {
  claude: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/**
 * Routes requests to LLM backends with per-request overrides and resilient fallbacks:
 * Claude → OpenAI → Mock when starting with Claude; OpenAI → Mock when starting with OpenAI.
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name)
  /** Provider health (not user state): providers with permanent errors are skipped for a while. */
  private readonly disabledUntil = new Map<AIProviderName, number>()

  constructor(
    private readonly config: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly mockProvider: MockProvider,
    private readonly claudeProvider: ClaudeProvider,
    private readonly openaiProvider: OpenAIProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async processMessage(input: AIInput, options?: ProcessMessageOptions): Promise<string> {
    const userId = options?.userId
    let enriched: AIInput = { ...input }

    if (userId && options?.useMemory !== false) {
      const retrieved = await this.memoryService.retrieveRelevantMemories(
        userId,
        input.message,
      )
      enriched = {
        ...enriched,
        memories: mergeMemories(enriched.memories ?? [], retrieved),
      }
    }

    const envDefault = this.config.get<string>('AI_PROVIDER', 'auto')
    
    // Evaluate if 'auto' router should be used
    let primary: AIProviderName
    let reason = ''
    
    if (options?.provider) {
      primary = this.normalizeProviderName(options.provider)
      reason = 'override'
    } else if (envDefault === 'auto') {
      const decision = this.decideRouter(input.message, input.context)
      primary = decision.provider
      reason = decision.reason
    } else {
      primary = this.normalizeProviderName(envDefault)
      reason = 'env_default'
    }

    this.logger.log(`processMessage → provider=${primary} reason=${reason}`)

    const text = await this.runWithFallback(enriched, primary)

    const shouldPersist =
      Boolean(userId) &&
      options?.persistConversation !== false &&
      text.length > 0

    if (shouldPersist && userId) {
      await this.memoryService.storeExchange(userId, input.message, text)
    }

    return text
  }

  private async runWithFallback(input: AIInput, start: AIProviderName): Promise<string> {
    const now = Date.now()
    const chain = this.fallbackChain(start).filter(
      (p) => this.isConfigured(p) && (this.disabledUntil.get(p) ?? 0) <= now,
    )
    let lastError: unknown

    for (const name of chain) {
      try {
        return await this.invokeProvider(name, input)
      } catch (err) {
        lastError = err
        const message = err instanceof Error ? err.message : String(err)
        if (name !== 'mock' && isPermanentProviderError(err)) {
          // Bad key, no credit or retired model: retrying every message only adds latency.
          this.disabledUntil.set(name, Date.now() + PROVIDER_COOLDOWN_MS)
          this.logger.warn(`Provider ${name} disabled for 10 min (${message.slice(0, 120)})`)
        } else {
          this.logger.warn(`Provider ${name} failed (${message.slice(0, 120)}); trying next in chain`)
        }
      }
    }

    const final = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`All providers failed. Last error: ${final}`)
  }

  /** Start provider first, then every other real provider, then mock. */
  private fallbackChain(start: AIProviderName): AIProviderName[] {
    const all: AIProviderName[] = ['openai', 'gemini', 'claude']
    if (start === 'mock') return ['mock']
    return [start, ...all.filter((p) => p !== start), 'mock']
  }

  /** Providers without an API key are skipped instead of failing every request. */
  private isConfigured(name: AIProviderName): boolean {
    if (name === 'mock') return true
    return Boolean(this.config.get<string>(PROVIDER_KEYS[name])?.trim())
  }

  private decideRouter(message: string, context?: string): { provider: AIProviderName, reason: string } {
    const wordCount = message.trim().split(/\s+/).length
    
    // Explicit insights or complex analysis -> Claude
    if (context === 'insight' || context === 'analysis') {
      return { provider: 'claude', reason: 'complex_context' }
    }
    
    // Check for calculation intent or financial analysis words
    const complexKeywords = ['analiza', 'resumen', 'tendencia', 'compara', 'presupuesto', 'ahorro', 'proyección']
    const isComplex = complexKeywords.some(kw => message.toLowerCase().includes(kw))
    
    if (isComplex || wordCount >= 15) {
      return { provider: 'claude', reason: 'complex_query' }
    }
    
    return { provider: 'gemini', reason: 'simple_query' }
  }

  private async invokeProvider(name: AIProviderName, input: AIInput): Promise<string> {
    switch (name) {
      case 'claude':
        return this.claudeProvider.generateResponse(input)
      case 'gemini':
        return this.geminiProvider.generateResponse(input)
      case 'openai':
        return this.openaiProvider.generateResponse(input)
      default:
        return this.mockProvider.generateResponse(input)
    }
  }

  private normalizeProviderName(value: string): AIProviderName {
    const v = value.trim().toLowerCase()
    if (v === 'mock' || v === 'claude' || v === 'openai' || v === 'gemini') {
      return v as AIProviderName
    }
    this.logger.warn(`Unknown AI_PROVIDER="${value}", defaulting to mock`)
    return 'mock'
  }
}
