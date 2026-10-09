export type AIProviderName = 'mock' | 'claude' | 'openai' | 'gemini'

export type Memory = {
  content: string
  role?: 'user' | 'assistant' | 'pattern'
  relevanceScore?: number
}

/**
 * Core LLM request shape. `userProfile` is intentionally loose so callers can
 * evolve schema without changing Nina’s core types.
 */
/**
 * Aggregated financial snapshot injected into the prompt.
 * Computed in InsightsService from the user's real expenses.
 */
export type UserInsights = {
  monthly_spending: number
  previous_month_spending: number
  trend: 'up' | 'down' | 'stable'
  category_breakdown?: Record<string, number> // legacy
  by_category: Record<string, number>
  top_category: string | null
  unusual_spending: boolean
  forecast_end_of_month?: number
  budget_status?: {
    over_budget: boolean
    warning: boolean
  } // legacy
  over_budget?: boolean
  warning?: boolean
}

export type AIInput = {
  message: string
  userProfile?: object
  memories?: Memory[]
  insights?: UserInsights | null
  plan?: 'free' | 'premium'
  /**
   * Optional; used by `MockProvider` for canned scenarios. Safe to omit for real models.
   */
  context?: 'expense_register' | 'query' | 'insight' | 'general'
  /** Full NinaFinanceEngine context for chat (replaces legacy insights block). */
  ninaSnapshotPrompt?: string
}

/**
 * Structured prompt: system instructions + conversational turns (no system role in `messages`).
 */
export type Prompt = {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}
