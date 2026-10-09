import type { AIInput } from '../ai.types'

/**
 * Contract for LLM backends. New providers implement this in `providers/` only.
 */
export interface AIProvider {
  generateResponse(input: AIInput): Promise<string>
}
