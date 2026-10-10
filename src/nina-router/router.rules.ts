export type RouterTier = 'small' | 'standard' | 'advanced'

export type RouterTask =
  | 'intent_classification'
  | 'categorize_fallback'
  | 'explain_insight'
  | 'chat_answer'
  | 'chat_answer_complex'
  | 'statement_parse_fallback'

export const ROUTER_RULES = {
  version: 1,
  promptVersion: 'chat-v2',
  tiers: {
    small: { providers: ['gemini', 'openai'], maxTokens: 400, temperature: 0 },
    standard: { providers: ['gemini', 'openai', 'claude'], maxTokens: 800, temperature: 0.2 },
    advanced: { providers: ['claude', 'gemini', 'openai'], maxTokens: 1200, temperature: 0.2 },
  },
  tasks: {
    intent_classification: { tier: 'small' as const, structured: true },
    categorize_fallback: { tier: 'small' as const, structured: true, batch: true },
    explain_insight: { tier: 'standard' as const, structured: true },
    chat_answer: { tier: 'standard' as const, structured: true, stream: true },
    chat_answer_complex: { tier: 'advanced' as const, structured: true, stream: true },
    statement_parse_fallback: { tier: 'advanced' as const, structured: true, requiresReview: true },
  },
  policies: {
    requireConsent: 'ai_processing',
    retryOnValidationFailure: 1,
    failoverTimeoutMs: 10_000,
  },
} as const

export function taskForFacts(intent: string, periodCount: number): RouterTask {
  if (periodCount > 2 || intent === 'whatif') return 'chat_answer_complex'
  return 'chat_answer'
}
