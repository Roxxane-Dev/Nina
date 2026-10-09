import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import type { AIInput } from '../ai.types'
import { buildPrompt } from '../prompt-builder'
import type { AIProvider } from './ai.provider.interface'

/** Claude model id — adjust via env later if product standard changes. */
const CLAUDE_MODEL = 'claude-opus-4-5'

@Injectable()
export class ClaudeProvider implements AIProvider {
  constructor(private readonly config: ConfigService) {}

  async generateResponse(input: AIInput): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }

    const prompt = buildPrompt(input)
    const maxTokens = input.plan === 'premium' ? 1000 : 500

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: prompt.system,
      messages: prompt.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content')
    }

    return textBlock.text
  }
}
