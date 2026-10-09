import { Injectable, Logger } from '@nestjs/common';
import { LLMMessage, LLMProvider, LLMResponse } from './llm-provider.interface';
import { GeminiProvider } from './gemini.provider';
import { ClaudeProvider } from './claude.provider';
import { OpenAIProvider } from './openai.provider';

export type TaskComplexity = 'simple' | 'complex' | 'fallback';

@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);
  private providers: Record<string, LLMProvider> = {};

  constructor(
    private gemini: GeminiProvider,
    private claude: ClaudeProvider,
    private openai: OpenAIProvider,
  ) {
    this.providers['gemini'] = this.gemini;
    this.providers['claude'] = this.claude;
    this.providers['openai'] = this.openai;
  }

  async route(messages: LLMMessage[], complexity: TaskComplexity = 'simple'): Promise<LLMResponse> {
    let primary: LLMProvider;
    let secondary: LLMProvider;

    switch (complexity) {
      case 'complex':
        primary = this.claude;
        secondary = this.gemini;
        break;
      case 'simple':
      default:
        primary = this.gemini;
        secondary = this.openai;
        break;
    }

    try {
      this.logger.log(`Routing task to primary provider: ${primary.name}`);
      return await primary.generateResponse(messages);
    } catch (e) {
      this.logger.warn(`Primary provider ${primary.name} failed. Falling back to ${secondary.name}. Error: ${e}`);
      try {
        return await secondary.generateResponse(messages);
      } catch (fallbackError) {
        this.logger.error(`Fallback provider ${secondary.name} also failed. Error: ${fallbackError}`);
        throw fallbackError;
      }
    }
  }
}
