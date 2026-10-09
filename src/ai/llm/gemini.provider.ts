import { Injectable, Logger } from '@nestjs/common';
import { LLMMessage, LLMProvider, LLMResponse } from './llm-provider.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateResponse(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Convert generic messages to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const history = messages
      .filter(m => m.role !== 'system' && m !== messages[messages.length - 1])
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const lastMessage = messages[messages.length - 1].content;

    try {
      const chat = model.startChat({
        systemInstruction,
        history,
      });

      const result = await chat.sendMessage(lastMessage);
      const text = result.response.text();
      
      return {
        text,
        provider: this.name,
        model: 'gemini-2.0-flash',
      };
    } catch (error) {
      this.logger.error(`Gemini provider error: ${error}`);
      throw error;
    }
  }
}
