import { Injectable } from '@nestjs/common'
import type { AIInput } from '../ai.types'
import type { AIProvider } from './ai.provider.interface'

@Injectable()
export class MockProvider implements AIProvider {
  async generateResponse(input: AIInput): Promise<string> {
    switch (input.context) {
      case 'expense_register':
        return 'Listo, registré tu gasto 👍 ¿algo más?'
      case 'query':
        return 'Llevas $320 gastados este mes. Vas bien 📊'
      case 'insight':
        return 'Hmm, noto que gastas más los fines de semana 👀'
      default:
        return 'Entendido. ¿En qué más te puedo ayudar?'
    }
  }
}
