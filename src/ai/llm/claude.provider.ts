import { Injectable, Logger } from '@nestjs/common';
import { LLMMessage, LLMProvider, LLMResponse } from './llm-provider.interface';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeProvider implements LLMProvider {
  name = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  async generateResponse(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const conversation = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      const msg = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        system: systemInstruction,
        messages: conversation,
      });

      return {
        text: msg.content[0].type === 'text' ? msg.content[0].text : '',
        provider: this.name,
        model: 'claude-3-7-sonnet',
        usage: {
          promptTokens: msg.usage.input_tokens,
          completionTokens: msg.usage.output_tokens,
          totalTokens: msg.usage.input_tokens + msg.usage.output_tokens,
        }
      };
    } catch (error) {
      this.logger.error(`Claude provider error: ${error}`);
      throw error;
    }
  }
}
