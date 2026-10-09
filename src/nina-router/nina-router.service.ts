import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import type { FactsPayload } from '../../packages/finance-engine/src'
import { AIService } from '../ai/ai.service'
import { MOCK_UNAVAILABLE_REPLY } from '../ai/providers/mock.provider'
import { buildGroundedUserPrompt, CHAT_SYSTEM_PROMPT_V1 } from './chat-prompt'
import { wrapUntrusted } from './redaction'
import { ROUTER_RULES, taskForFacts, type RouterTask } from './router.rules'
import {
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
        const parsed = parseLlmAnswer(raw) ?? {
          message: raw,
          figuresUsed: Object.keys(facts.figures),
          followUps: [],
        }
        last = parsed
        const v = validateAnswer(parsed, facts)
        if (v.ok) {
          passed = true
          break
        }
        this.logger.warn(`validation failed: ${v.reason}`)
        retryCount += 1
      } catch (e) {
        this.logger.warn(`LLM call failed: ${e}`)
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
}
