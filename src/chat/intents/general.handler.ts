import { Injectable, Optional } from '@nestjs/common'
import { NinaRouterService } from '../../nina-router/nina-router.service'
import { HELP_REPLY, suggestedFollowUps } from '../answer-card'
import { CALM_REPLIES } from '../calm-mode'
import { reply } from '../chat-reply'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'

export const UNRECOGNIZED_REPLY =
  'Esa no la agarré 🫠 ¿Me la dices de otra forma? Por ejemplo: «¿cuánto gasté en comida?» o «¿me alcanza para unas zapatillas?».'

export const OUT_OF_SCOPE_REPLY =
  'Eso se me escapa 😅 Lo mío es tu plata: pregúntame cuánto te queda, a dónde se fue o si te alcanza para algo. O cuéntame un gasto: «gasté 25 en taxi».'

const EXAMPLES = ['¿Cuánto me queda este mes?', '¿A dónde se fue mi plata?', '¿Me alcanza para algo?']

/**
 * otro / chat_general — help, out-of-scope requests and anything that is not a
 * registration or a supported question. It is last and always answers.
 *
 * Open conversation (CI-01): with AI consent and outside calm mode, the LLM may
 * answer in Nina's voice, but never with a figure (open-validator.ts). Without
 * a validated answer the deterministic reply below is used.
 */
@Injectable()
export class GeneralHandler implements ChatIntentHandler {
  readonly name = 'general'

  constructor(@Optional() private readonly router?: NinaRouterService) {}

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
        return (await this.converse(ctx)) ?? { outcome: 'unrecognized', reply: reply(UNRECOGNIZED_REPLY, { followUps: EXAMPLES }) }
      default:
        return (await this.converse(ctx)) ?? { outcome: 'unrecognized', reply: reply(OUT_OF_SCOPE_REPLY, { followUps: EXAMPLES }) }
    }
  }

  /** LLM conversation without figures; null keeps the deterministic reply. */
  private async converse(ctx: ChatContext): Promise<HandlerResult | null> {
    if (!this.router || !ctx.aiAllowed || ctx.calm) return null
    const answer = await this.router.converse(ctx.userId, ctx.message)
    if (!answer) return null
    return {
      outcome: 'ok',
      llmUsed: true,
      validationPassed: true,
      reply: reply(answer.message, { followUps: answer.followUps.length ? answer.followUps : EXAMPLES }),
    }
  }
}
