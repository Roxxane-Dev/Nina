export interface LLMResponse {
  text: string
  provider: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMProvider {
  name: string
  generateResponse(messages: LLMMessage[], options?: any): Promise<LLMResponse>
}
