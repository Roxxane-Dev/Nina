import { Injectable } from '@nestjs/common'
import type { AIInput } from '../ai.types'
import type { AIProvider } from './ai.provider.interface'

/**
 * Last-resort provider when no LLM is configured or all providers failed.
 * It must never state figures: numbers only come from the finance engine.
 */
export const MOCK_UNAVAILABLE_REPLY =
  'Ahora mismo no puedo generar una explicación. Tus cifras siguen disponibles en el inicio.'

@Injectable()
export class MockProvider implements AIProvider {
  async generateResponse(_input: AIInput): Promise<string> {
    return MOCK_UNAVAILABLE_REPLY
  }
}
