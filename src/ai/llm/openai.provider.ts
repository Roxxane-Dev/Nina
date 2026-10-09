import { Injectable, Logger } from '@nestjs/common';
import { LLMMessage, LLMProvider, LLMResponse } from './llm-provider.interface';
import OpenAI from 'openai';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async generateResponse(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
      });

      return {
        text: response.choices[0]?.message?.content || '',
        provider: this.name,
        model: 'gpt-4o-mini',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        }
      };
    } catch (error) {
      this.logger.error(`OpenAI provider error: ${error}`);
      throw error;
    }
  }
}
