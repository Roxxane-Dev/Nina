import { Injectable } from '@nestjs/common'
import { localToday, resolveQuestion, type FactsPayload, savingsPace, simulatePurchase } from '../../../packages/finance-engine/src'
import { formatSoles } from '../../common/money'
import { FinanceEngineService } from '../../finance-engine/finance-engine.service'
import { GoalService } from '../../goals/goal.service'
import { goalPlanView } from '../../goals/goal-plans'
import { templatedAnswer } from '../../nina-router/validator'
import { buildCard, suggestedFollowUps } from '../answer-card'
import { reply } from '../chat-reply'
import { outlookText } from '../outlook-text'
import { scoreText } from '../score-text'
import { hasAmount } from '../conversation-context'
import type { ChatContext, ChatIntentHandler, HandlerResult } from './handler'
import { QueryResponder } from './query-responder'

/** Lowercase without accents, so "Explícame" matches "explicame". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const SIMPLER = /\b(no (te )?entiendo|no entendi|no lo entiendo|mas simple|mas facil|mas sencillo|explica(me)? (eso|mejor|de nuevo|otra vez)|en cristiano|como asi)\b/
const SAVING_VS_LEFTOVER = /diferencia entre (ahorrar|el ahorro|ahorro)|(que|cual) es la diferencia.*(ahorr|sobr)|que (es|significa) ahorrar/
const IMPULSE = /(compre|me compre|me di un gusto).*(no necesitaba|innecesari|antojo|impulso|otra cosa)|no necesitaba.*(jaja|lol|xd)/
const REMEMBER_GOAL = /\b(acuerdate|recuerda|recordar|te cuento|para que sepas)\b.*\b(ahorrando|juntando|ahorrar|juntar)\b|\bestoy (ahorrando|juntando) (plata |dinero )?para\b/
const SAVE_MORE = /\b(ayudame a ahorrar|quiero ahorrar mas|ahorrar mas|como ahorro mas|como hago para ahorrar)\b/
const PURCHASE = /\b(quiero|voy a|pienso|estoy pensando en|deberia|puedo|podria|me conviene) (comprar(me)?|comprarme)\b|\bme alcanza para\b|\bvale la pena comprar\b/
const BALANCE_VS_AVAILABLE = /\b(tengo|hay) (plata|dinero|saldo) en (mi|la) cuenta\b|\bpuedo gastar(la|lo|me)?\b/

const STOP = new Set(['pero', 'y', 'que', 'si', 'o', 'porque', 'no', 'para', 'con', 'de', 'a', 'en', 'cuesta', 'cuestan', 'vale', 'valen', 'me', 'se', 'lo'])

/** "comprarme unas zapatillas pero…" → "unas zapatillas". */
function purchaseItem(message: string): string | undefined {
  const m = fold(message).match(/\b(?:comprar(?:me)?|compro|me alcanza para|vale la pena comprar)\s+(.+)/)
  if (!m) return undefined
  const words: string[] = []
  for (const w of m[1].replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(Boolean)) {
    if (/\d/.test(w) || STOP.has(w)) break
    words.push(w)
    if (words.length >= 3) break
  }
  const item = words.join(' ').trim()
  return item && !/^(eso|esto|algo|nada)$/.test(item) ? item : undefined
}

/** "en 6 cuotas" → 6; "6 cuotas de 500" → { n: 6, each: 500 }. */
function installmentsIn(message: string): { n: number; each: number | null } | null {
  const m = fold(message).match(/\b(\d{1,2})\s*cuotas(?:\s+de\s+(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?))?/)
  if (!m) return null
  return { n: Number(m[1]), each: m[2] ? Number(m[2].replace(',', '.')) : null }
}

/** The price in a follow-up ("cuestan 350 soles", "S/ 89.90", "como 200"). */
function priceIn(message: string): number | null {
  const m = message.replace(/\b\d{1,2}\s*cuotas(?:\s+de)?/gi, ' ').replace(/\b20\d\d\b/g, ' ').match(/(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(mil|k)?/i)
  if (!m) return null
  let value = parseFloat(m[1].replace(/[.,]/g, '') + (m[2] ? `.${m[2]}` : ''))
  if (m[3]) value *= 1000
  return value > 0 ? value : null
}

/** "estoy ahorrando para un viaje" → "un viaje". */
function goalTopic(message: string): string | undefined {
  const m = fold(message).match(/\bpara\s+(?:mi\s+|el\s+|la\s+)?(un[oa]?s?\s+)?([a-zn ]{3,40})/)
  if (!m) return undefined
  return `${m[1] ?? ''}${m[2]}`.replace(/[?.!,].*$/, '').trim().split(/\s+/).slice(0, 4).join(' ')
}

/**
 * Conversation, not queries: the turns where a beginner talks to Nina instead
 * of asking for a figure ("no entiendo", "me compré otra cosa jaja", "quiero
 * comprarme unas zapatillas"). Deterministic: every figure it shows comes from
 * the engine; when the answer needs a number Nina does not have, she asks for it.
 */
@Injectable()
export class ConversationHandler implements ChatIntentHandler {
  readonly name = 'conversation'

  constructor(
    private readonly engine: FinanceEngineService,
    private readonly responder: QueryResponder,
    private readonly goals: GoalService,
  ) {}

  async handle(ctx: ChatContext): Promise<HandlerResult | null> {
    const text = fold(ctx.message)
    const conv = ctx.conversation

    // 1) Follow-up with the price Nina asked for.
    if (conv?.awaiting === 'purchase_price' && hasAmount(ctx.message) && !/\b(gaste|pague|compre)\b/.test(text)) {
      const price = priceIn(ctx.message)
      if (price) return this.affordability(ctx, conv.item, price)
    }

    // 2) "No entiendo / más simple": the same answer again, from the template, in plain words.
    if (SIMPLER.test(text)) return this.simpler(ctx)

    if (SAVING_VS_LEFTOVER.test(text)) {
      return {
        outcome: 'ok',
        reply: reply(
          'Buena pregunta, y casi nadie la hace. Lo que te sobra es lo que quedó al final del mes, sin plan: si no hiciste nada con eso, se va solito en antojos. ' +
            'Ahorrar es separar una parte a propósito, apenas cobras, antes de gastar. La diferencia es la intención. ¿Quieres que veamos cuánto te sobró este mes?',
          { followUps: ['¿Cuánto me queda este mes?', 'Quiero ahorrar para algo', '¿En qué gasto más?'] },
        ),
      }
    }

    if (IMPULSE.test(text) && !hasAmount(ctx.message)) {
      return {
        outcome: 'ok',
        awaiting: { kind: 'expense_amount', draft: 'compras' },
        reply: reply(
          'Jaja, nos pasa a las mejores 💅 Sin culpa. ¿Cuánto fue? Lo registro y te digo si le movió algo a tu mes.',
          { followUps: ['¿Cuánto me queda este mes?', '¿En qué gasto más?'] },
        ),
      }
    }

    if (REMEMBER_GOAL.test(text) && !hasAmount(ctx.message)) {
      const topic = goalTopic(ctx.message)
      return {
        outcome: 'ok',
        awaiting: { kind: 'goal_details', draft: `quiero ahorrar para ${topic ?? 'mi meta'}`, item: topic },
        reply: reply(
          `${topic ? `Un ${topic.replace(/^un[oa]?s?\s+/, '')}, me encanta ✈️` : 'Me encanta.'} Para no perderlo de vista guardémoslo como meta: ¿cuánto necesitas y para cuándo? Por ejemplo: «3000 soles para abril».`,
          { followUps: ['¿Cuánto me queda este mes?', '¿Cómo puedo ahorrar más?'] },
        ),
      }
    }

    if (SAVE_MORE.test(text) && !hasAmount(ctx.message)) return this.saveMore(ctx)

    if ((PURCHASE.test(text) || ctx.question.intent === 'whatif') && ctx.question.intent !== 'goal_plan') {
      const item = purchaseItem(ctx.message)
      const cuotas = installmentsIn(ctx.message)
      // "6 cuotas de 500" names the installment: the price is the total.
      const price = cuotas?.each ? cuotas.n * cuotas.each : hasAmount(ctx.message) ? priceIn(ctx.message) : null
      if (price) return this.affordability(ctx, item, price, cuotas?.n ?? 0)
      const plural = item ? /s$/.test(item.split(' ').pop() ?? '') : false
      const plans = conv?.goalTopic ? ` sin frenar tu ahorro para ${conv.goalTopic}` : ' sin desordenar tus planes'
      return {
        outcome: 'ok',
        awaiting: { kind: 'purchase_price', item },
        reply: reply(
          item
            ? `Ok, ${item}: hablemos de eso 👀 ¿Cuánto ${plural ? 'cuestan' : 'cuesta'}? Te digo si ${plural ? 'entran' : 'entra'} en tu mes${plans}.`
            : `Ok, hablemos de eso 👀 ¿Cuánto cuesta? Te digo si entra en tu mes${plans}.`,
          { followUps: ['¿Cuánto me queda este mes?'] },
        ),
      }
    }

    if (BALANCE_VS_AVAILABLE.test(text) && ctx.question.intent === 'available') {
      // One voice: the explanation and the engine figures, no second LLM opinion that could contradict it.
      const result = await this.answer(ctx, '¿cuánto me queda este mes?', true)
      if (!result) return null
      result.reply.reply =
        'No toda, bestie 👀 Lo que ves en tu cuenta es tu saldo. Lo que de verdad está libre es lo que te queda después de lo que ya gastaste y de lo que todavía tienes que pagar. ' +
        `Con lo que registraste en Nina: ${lowerFirst(result.reply.reply)} Si aún tienes pagos pendientes este mes (alquiler, luz, una cuota), réstalos de ahí antes de darte un gusto.`
      result.reply.followUps = ['¿En qué gasto más?', '¿Me alcanza para algo?', 'Muéstrame mis últimos gastos']
      return result
    }

    // INS-02: the score and why, from the engine. Never through the LLM.
    if (ctx.question.intent === 'score') {
      const { score } = await this.engine.computeBundle(ctx.userId, ctx.asOf)
      return {
        outcome: 'ok',
        llmUsed: false,
        validationPassed: true,
        reply: reply(scoreText(score), { followUps: ['¿En qué gasto más?', '¿Cuánto me queda este mes?'] }),
      }
    }

    // INS-03: the month-end projection, with its assumptions. Only this month; never invented.
    if (ctx.question.intent === 'forecast') {
      const { outlook } = await this.engine.outlook(ctx.userId, ctx.asOf)
      if (outlook) {
        const later = ctx.question.period?.future ? 'Por ahora proyecto solo el cierre de este mes. ' : ''
        return {
          outcome: 'ok',
          llmUsed: false,
          validationPassed: true,
          reply: reply(`${later}${outlookText(outlook)}`, {
            followUps: ['¿En qué gasto más?', '¿Cuánto me queda este mes?', 'Quiero ahorrar para algo'],
          }),
        }
      }
      const result = await this.answer(ctx, '¿cuánto me queda este mes?', true)
      if (!result) return null
      result.reply.reply = `Para proyectar sin inventar necesito al menos dos meses de movimientos. Lo que sí sé con tus datos: ${lowerFirst(result.reply.reply)}`
      result.reply.followUps = ['¿En qué gasto más?', '¿Cuánto gasté este mes?', 'Quiero ahorrar para algo']
      return result
    }

    return null
  }

  /** Engine facts for a fixed question, explained by the responder (LLM only with consent, validated). */
  private async answer(ctx: ChatContext, question: string, templateOnly = false): Promise<HandlerResult | null> {
    const q = resolveQuestion(question, ctx.asOf)
    const { facts } = await this.engine.factsForResolved(ctx.userId, q, ctx.asOf)
    if (!facts.context?.hasHistory) return null
    if (templateOnly) return this.template(facts)
    return this.responder.explain({ ...ctx, question: q }, facts)
  }

  private template(facts: FactsPayload, prefix = ''): HandlerResult {
    return {
      outcome: 'ok',
      llmUsed: false,
      validationPassed: true,
      engineVersion: facts.engineVersion,
      reply: reply(`${prefix}${templatedAnswer(facts).message}`, {
        card: buildCard(facts),
        followUps: suggestedFollowUps(facts.intent),
        grounded: { intent: facts.intent, validationPassed: true, usedLlm: false, engineVersion: facts.engineVersion },
      }),
    }
  }

  private async simpler(ctx: ChatContext): Promise<HandlerResult> {
    const last = ctx.conversation?.lastQuestion
    if (last) {
      const q = resolveQuestion(last, ctx.asOf)
      const { facts } = await this.engine.factsForResolved(ctx.userId, q, ctx.asOf)
      if (facts.context?.hasHistory) {
        const plain = SIMPLE_EXPLAINERS[facts.intent] ?? ''
        return this.template(facts, `Va, en simple: ${plain}`)
      }
    }
    return {
      outcome: 'ok',
      reply: reply('Perdón, me enredé yo 🫠 ¿Qué parte no quedó clara? Pregúntamelo de nuevo con tus palabras y te lo explico en corto.', {
        followUps: ['¿Cuánto me queda este mes?', '¿En qué gasto más?'],
      }),
    }
  }

  private async simulated(
    ctx: ChatContext,
    item: string | undefined,
    price: number,
    installments: number,
    asOf: Date,
  ): Promise<HandlerResult | null> {
    const [{ outlook }, txs, goals] = await Promise.all([
      this.engine.outlook(ctx.userId, asOf),
      this.engine.loadTransactions(ctx.userId),
      this.goals.listActive(ctx.userId).catch(() => []),
    ])
    if (!outlook) return null
    const pace = savingsPace(txs, asOf)
    const s = simulatePurchase(outlook, { cost: price, installments }, pace?.pace ?? null)
    const what = item ? item.replace(/^(un|una|unos|unas|esta|este|estas|estos)\s+/, '') : 'eso'
    const plural = /s$/.test(what.split(' ').pop() ?? '')
    const lines = [ctx.calm ? `${capitalize(what)} a ${formatSoles(price)}.` : `${capitalize(what)} a ${formatSoles(price)}. Hagamos reality check 👀`]
    lines.push(
      s.installments > 0
        ? `En ${s.installments} cuotas de ${formatSoles(s.monthlyPayment)} (sin contar los intereses de tu tarjeta), este mes cerrarías con unos ${formatSoles(s.projectedAfter)} en vez de ${formatSoles(s.projectedBefore)}.`
        : `Si ${plural ? 'las' : 'la'} compras al contado, cerrarías ${outlook.monthLabel} con unos ${formatSoles(s.projectedAfter)} en vez de ${formatSoles(s.projectedBefore)}.`,
    )
    if (outlook.overdueIncome > 0) {
      // A verdict built on a month missing its usual income would scare for no reason.
      lines.push(
        `Ojo: no estoy contando tu ingreso de siempre (unos ${formatSoles(outlook.overdueIncome)}) porque aún no está registrado. Si ya te pagaron, cuéntamelo y lo recalculo.`,
      )
    } else {
      lines.push(
        s.verdict === 'fits'
          ? `${plural ? 'Entran' : 'Entra'} sin drama.`
          : s.verdict === 'tight'
            ? `${plural ? 'Entran' : 'Entra'}, pero justo: te quedaría menos de una semana de tu gasto típico de margen.`
            : 'Este mes no entra: cerrarías en rojo. Si la quieres, quizá conviene esperar al próximo ingreso.',
      )
    }
    if (s.monthsOfSavings !== null) {
      const paceText = formatSoles(Math.round(pace!.pace * 100) / 100)
      lines.push(
        s.monthsOfSavings < 1
          ? `A tu ritmo de ahorro (${paceText} al mes), es menos de un mes de ahorro.`
          : `A tu ritmo de ahorro (${paceText} al mes), equivale a ${s.monthsOfSavings} ${s.monthsOfSavings === 1 ? 'mes' : 'meses'} de ahorro.`,
      )
    }
    const goal = goals.map((g) => goalPlanView(g, txs, asOf)).find((v) => v.remaining > 0 && v.plan.requiredPerMonth)
    if (goal) lines.push(`Y no te olvides de tu meta «${goal.name}»: para llegar apartas ${formatSoles(goal.plan.requiredPerMonth!)} al mes.`)
    lines.push('La decisión es tuya.')
    return {
      outcome: 'ok',
      llmUsed: false,
      validationPassed: true,
      reply: reply(lines.join(' '), {
        followUps: [`Gasté ${price} en ${what}`, `Quiero juntar ${price} soles para ${what}`, '¿Cuánta plata voy a tener a fin de mes?'],
      }),
    }
  }

  private async saveMore(ctx: ChatContext): Promise<HandlerResult> {
    const q = resolveQuestion('¿en qué gasto más este mes?', ctx.asOf)
    const { facts } = await this.engine.factsForResolved(ctx.userId, q, ctx.asOf)
    const top = facts.context?.hasHistory ? facts.items?.[0] : undefined
    const hint = top ? ` Pista: tu mayor gasto este mes es ${top.label} (${formatSoles(top.amount)}); por ahí suele estar la plata más fácil de liberar.` : ''
    return {
      outcome: 'ok',
      engineVersion: facts.engineVersion,
      awaiting: { kind: 'goal_details', draft: 'quiero ahorrar para' },
      reply: reply(
        `Me encanta esa energía 🔥 El truco que sí funciona: ponerle nombre y número.${hint} ¿Para qué quieres ahorrar y cuánto? Por ejemplo: «1500 soles para un viaje en abril».`,
        { followUps: ['¿En qué gasto más?', '¿Cuánto me queda este mes?'] },
      ),
    }
  }

  /**
   * "¿Me alcanza?" / "¿qué pasa si compro…?" (INS-06): the purchase on top of the month-end outlook,
   * computed by the engine. With too little history to project, what is left this month and the goals.
   */
  private async affordability(ctx: ChatContext, item: string | undefined, price: number, installments = 0): Promise<HandlerResult> {
    const asOf = ctx.asOf ?? localToday(new Date())
    const simulated = await this.simulated(ctx, item, price, installments, asOf)
    if (simulated) return simulated
    const q = resolveQuestion('¿cuánto me queda este mes?', asOf)
    const [{ facts }, goals] = await Promise.all([
      this.engine.factsForResolved(ctx.userId, q, asOf),
      this.goals.listActive(ctx.userId).catch(() => []),
    ])
    const what = item ? `${item.replace(/^(un|una|unos|unas|esta|este|estas|estos)\s+/, '')}` : 'eso'
    if (!facts.context?.hasHistory) {
      return {
        outcome: 'no_data',
        reply: reply(
          `Anotado: ${what} a ${formatSoles(price)}. Para decirte si entra necesito ver tu mes, y todavía no tienes movimientos registrados. Cuéntame tu ingreso y tus gastos principales y lo vemos.`,
          { followUps: ['Me pagaron 3500 de sueldo', 'Gasté 25 en taxi'] },
        ),
      }
    }
    const available = facts.figures.available
    const lines = [
      ctx.calm ? `${capitalize(what)} a ${formatSoles(price)}.` : `${capitalize(what)} a ${formatSoles(price)}. Hagamos reality check 👀`,
      available >= 0
        ? `Este mes, según lo que registraste, te quedan ${formatSoles(available)}.`
        : `Este mes ya gastaste más de lo que entró: vas ${formatSoles(available)}. Ojo con sumar compras ahora.`,
    ]
    let goalLine: { name: string; perMonth: number } | null = null
    if (goals.length) {
      const txs = await this.engine.loadTransactions(ctx.userId)
      for (const g of goals) {
        const v = goalPlanView(g, txs, asOf)
        if (v.remaining > 0 && v.plan.requiredPerMonth) {
          goalLine = { name: v.name, perMonth: v.plan.requiredPerMonth }
          break
        }
      }
    }
    if (goalLine) {
      lines.push(`Y no te olvides de tu meta «${goalLine.name}»: para llegar apartas ${formatSoles(goalLine.perMonth)} al mes.`)
    } else if (ctx.conversation?.goalTopic) {
      // Said earlier in this conversation, not saved yet: mention it without inventing figures.
      lines.push(`Y ojo con tu ahorro para ${ctx.conversation.goalTopic}: todavía no le pusimos número, así que no sé cuánto le quita esta compra. Si me dices cuánto necesitas y para cuándo, lo armamos.`)
    }
    lines.push('La decisión es tuya. Si lo compras, regístralo y te digo cómo queda tu mes.')
    return {
      outcome: 'ok',
      llmUsed: false,
      engineVersion: facts.engineVersion,
      reply: reply(lines.join(' '), {
        card: buildCard(facts),
        followUps: [`Gasté ${price} en ${what}`, `Quiero juntar ${price} soles para ${what}`, '¿En qué gasto más?'],
        grounded: { intent: 'available', validationPassed: true, usedLlm: false, engineVersion: facts.engineVersion },
      }),
    }
  }
}

/** One plain-language line per intent, said before the figures when the user asks for it simpler. */
const SIMPLE_EXPLAINERS: Partial<Record<string, string>> = {
  available: 'lo que entró menos lo que salió es lo que te queda. ',
  balance: 'todo lo que entró menos todo lo que salió desde que usas Nina. ',
  spending_summary: 'esto es todo lo que salió de tu bolsillo en ese tiempo. ',
  spending_breakdown: 'te muestro en qué cosas se fue más plata, de mayor a menor. ',
  category_spend: 'esto es lo que se fue solo en esa categoría. ',
  income: 'esto es toda la plata que te entró. ',
  goal_plan: 'divido lo que te falta entre los meses que quedan y lo comparo con lo que te suele sobrar. ',
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
