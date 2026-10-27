import { Injectable } from '@nestjs/common'
import { HELP_REPLY, suggestedFollowUps } from '../answer-card'
import { CALM_REPLIES } from '../calm-mode'
import { reply } from '../chat-reply'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'

export const UNRECOGNIZED_REPLY =
  'Esa no la agarré 🫠 ¿Me la dices de otra forma? Por ejemplo: «¿cuánto gasté en comida?» o «¿me alcanza para unas zapatillas?».'

const EXAMPLES = ['¿Cuánto me queda este mes?', '¿A dónde se fue mi plata?', '¿Me alcanza para algo?']

/**
 * otro / chat_general — help, out-of-scope requests and anything that is not a
 * registration or a supported question. Deterministic (no LLM, no figures), so
 * it can never fail or invent numbers. It is last and always answers.
 */
@Injectable()
export class GeneralHandler implements ChatIntentHandler {
  readonly name = 'general'

  async handle(ctx: ChatContext): Promise<HandlerResult> {
    // Calm mode: fixed, humorless reply (PRD-VOX-02). No LLM, no figures.
    if (ctx.calm && ctx.question.intent !== 'help') {
      const calm = CALM_REPLIES[ctx.calm]
      return { outcome: 'ok', reply: reply(calm.reply, { followUps: calm.followUps }) }
    }
    switch (ctx.question.intent) {
      case 'help':
        return { outcome: 'ok', reply: reply(HELP_REPLY, { followUps: suggestedFollowUps('help') }) }
      case 'whatif':
        return {
          outcome: 'ok',
          reply: reply(
            'Todavía no simulo escenarios de "¿qué pasa si…?". Lo que sí puedo: decirte cuánto te queda este mes y si una compra entra. Dime qué quieres comprar y cuánto cuesta.',
            { followUps: ['¿Cuánto me queda?', '¿En qué gasto más?'] },
          ),
        }
      case 'unknown_finance':
        return { outcome: 'unrecognized', reply: reply(UNRECOGNIZED_REPLY, { followUps: EXAMPLES }) }
      default:
        return {
          outcome: 'unrecognized',
          reply: reply(
            'Eso se me escapa 😅 Lo mío es tu plata: pregúntame cuánto te queda, a dónde se fue o si te alcanza para algo. O cuéntame un gasto: «gasté 25 en taxi».',
            { followUps: EXAMPLES },
          ),
        }
    }
  }
}
