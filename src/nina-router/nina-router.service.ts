import { Injectable, Logger } from '@nestjs/common'
import { reasonCode, safeErrorCode } from '../common/log-safe'
import { createHash } from 'crypto'
import type { FactsPayload } from '../../packages/finance-engine/src'
import { AIService } from '../ai/ai.service'
import { MOCK_UNAVAILABLE_REPLY } from '../ai/providers/mock.provider'
import { buildGroundedUserPrompt, CHAT_OPEN_PROMPT_V1, CHAT_SYSTEM_PROMPT_V1 } from './chat-prompt'
import { cleanFollowUps, validateOpenAnswer, type OpenAnswer } from './open-validator'
import { wrapUntrusted } from './redaction'
import { ROUTER_RULES, taskForFacts, type RouterTask } from './router.rules'
import {
  looseAnswer,
  parseLlmAnswer,
  templatedAnswer,
  validateAnswer,
  type LlmAnswer,
} from './validator'

export type RouterResult = {
  answer: LlmAnswer
  task: RouterTask
  promptVersion: string
  validationPassed: boolean
  retryCount: number
  inputHash: string
  usedLlm: boolean
}

@Injectable()
export class NinaRouterService {
  private readonly logger = new Logger(NinaRouterService.name)

  constructor(private readonly ai: AIService) {}

  async explainFacts(
    userId: string,
    question: string,
    facts: FactsPayload,
  ): Promise<RouterResult> {
    const task = taskForFacts(facts.intent, 1)
    const inputHash = createHash('sha256')
      .update(`${userId}|${facts.engineVersion}|${JSON.stringify(facts.figures)}|${question}`)
      .digest('hex')
    const wrapped = wrapUntrusted(question)
    const prompt = buildGroundedUserPrompt(facts, wrapped)

    let retryCount = 0
    let last: LlmAnswer | null = null
    let passed = false

    while (retryCount <= ROUTER_RULES.policies.retryOnValidationFailure) {
      try {
        const raw = await this.ai.processMessage(
          {
            message: prompt,
            context: 'query',
            ninaSnapshotPrompt: CHAT_SYSTEM_PROMPT_V1,
          },
          { userId, persistConversation: false, useMemory: false },
        )
        // No real LLM answered: fall back to the engine-only template below.
        if (raw.trim() === MOCK_UNAVAILABLE_REPLY) break
        const parsed = parseLlmAnswer(raw) ?? looseAnswer(raw, Object.keys(facts.figures))
        last = parsed
        const v = validateAnswer(parsed, facts)
        if (v.ok) {
          passed = true
          break
        }
        this.logger.warn(`validation failed: ${reasonCode(v.reason)}`)
        retryCount += 1
      } catch (e) {
        this.logger.warn(`LLM call failed: ${safeErrorCode(e)}`)
        retryCount += 1
      }
    }

    if (!passed) {
      return {
        answer: templatedAnswer(facts),
        task,
        promptVersion: ROUTER_RULES.promptVersion,
        validationPassed: false,
        retryCount,
        inputHash,
        usedLlm: false,
      }
    }

    return {
      answer: last!,
      task,
      promptVersion: ROUTER_RULES.promptVersion,
      validationPassed: true,
      retryCount,
      inputHash,
      usedLlm: true,
    }
  }

  /**
   * Open conversation without figures (CI-01). Only the user's message goes to
   * the LLM — redacted and wrapped as untrusted; no facts, no memories, nothing
   * persisted. Any number in the answer fails validation. Returns null when no
   * validated answer is available, so the caller keeps its deterministic reply.
   * The caller checks AI consent and calm mode before calling.
   */
  async converse(userId: string, message: string): Promise<OpenAnswer | null> {
    const prompt = `USER_MESSAGE:\n${wrapUntrusted(message)}`
    for (let attempt = 0; attempt <= ROUTER_RULES.policies.retryOnValidationFailure; attempt++) {
      try {
        const raw = await this.ai.processMessage(
          { message: prompt, context: 'general', ninaSnapshotPrompt: CHAT_OPEN_PROMPT_V1 },
          { userId, persistConversation: false, useMemory: false },
        )
        if (raw.trim() === MOCK_UNAVAILABLE_REPLY) return null
        const parsed = parseLlmAnswer(raw) ?? looseAnswer(raw, [])
        const answer: OpenAnswer = { message: parsed.message.trim(), followUps: cleanFollowUps(parsed.followUps) }
        const v = validateOpenAnswer(answer)
        if (v.ok) return answer
        this.logger.warn(`open validation failed: ${reasonCode(v.reason)}`)
      } catch (e) {
        this.logger.warn(`open LLM call failed: ${safeErrorCode(e)}`)
      }
    }
    return null
  }
}
