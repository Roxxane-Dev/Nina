import { Injectable } from '@nestjs/common'
import { HELP_REPLY, suggestedFollowUps } from '../answer-card'
import { reply } from '../chat-reply'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'

export const UNRECOGNIZED_REPLY = 'No entendí bien esa pregunta, ¿puedes reformularla?'

const EXAMPLES = ['¿Cuánto gasté este mes?', '¿Cuál es mi saldo?', 'Gasté 25 en taxi']

/**
 * otro / chat_general — help, out-of-scope requests and anything that is not a
 * registration or a supported question. Deterministic (no LLM, no figures), so
 * it can never fail or invent numbers. It is last and always answers.
 */
@Injectable()
export class GeneralHandler implements ChatIntentHandler {
  readonly name = 'general'

  async handle(ctx: ChatContext): Promise<HandlerResult> {
    switch (ctx.question.intent) {
      case 'help':
        return { outcome: 'ok', reply: reply(HELP_REPLY, { followUps: suggestedFollowUps('help') }) }
      case 'whatif':
        return {
          outcome: 'ok',
          reply: reply(
            'Todavía no puedo simular compras ni escenarios de "¿qué pasa si…?". Por ahora puedo decirte cuánto gastas, en qué y cuánto te queda.',
            { followUps: ['¿Cuánto me queda?', '¿En qué gasto más?'] },
          ),
        }
      case 'unknown_finance':
        return { outcome: 'unrecognized', reply: reply(UNRECOGNIZED_REPLY, { followUps: EXAMPLES }) }
      default:
        return {
          outcome: 'unrecognized',
          reply: reply(
            'Soy Nina y me enfoco en tu plata 🙂 Puedo registrar tus gastos e ingresos y decirte en qué se te va el dinero.',
            { followUps: EXAMPLES },
          ),
        }
    }
  }
}
