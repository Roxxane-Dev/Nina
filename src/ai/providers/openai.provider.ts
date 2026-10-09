import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { AIInput } from '../ai.types'
import { buildPrompt } from '../prompt-builder'
import type { AIProvider } from './ai.provider.interface'

@Injectable()
export class OpenAIProvider implements AIProvider {
  constructor(private readonly config: ConfigService) { }

  async generateResponse(input: AIInput): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim()
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const prompt = buildPrompt(input)
    const maxTokens = input.plan === 'premium' ? 800 : 400

    const modelName = this.config.get<string>('OPENAI_CHAT_MODEL')?.trim() || 'gpt-4o-mini'

    const client = new OpenAI({ apiKey })

    const completion = await client.chat.completions.create({
      model: modelName,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: prompt.system },
        ...prompt.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    })

    const text = completion.choices[0]?.message?.content
    if (!text) {
      throw new Error('OpenAI returned empty content')
    }

    return text
  }
}
