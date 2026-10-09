import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIInput } from '../ai.types'
import { buildPrompt } from '../prompt-builder'
import type { AIProvider } from './ai.provider.interface'

@Injectable()
export class GeminiProvider implements AIProvider {
  constructor(private readonly config: ConfigService) { }

  async generateResponse(input: AIInput): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim()
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    const modelName = this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-flash-latest'

    const prompt = buildPrompt(input)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: prompt.system,
    })

    const chat = model.startChat({
      history: prompt.messages.slice(0, -1).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    })

    const lastMessage = prompt.messages[prompt.messages.length - 1]
    const result = await chat.sendMessage(lastMessage.content)

    const text = result.response.text()
    if (!text) {
      throw new Error('Gemini returned empty content')
    }

    return text
  }
}
