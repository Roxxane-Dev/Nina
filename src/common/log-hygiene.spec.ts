import { Logger } from '@nestjs/common'
import type { FactsPayload } from '../../packages/finance-engine/src'
import { AIService } from '../ai/ai.service'
import { LongTermMemoryService } from '../ai/memory/long-term-memory.service'
import { MemoryRankingService } from '../ai/memory/memory-ranking.service'
import { NinaRouterService } from '../nina-router/nina-router.service'
import { reasonCode, safeErrorCode, statusFromMessage } from './log-safe'

const SECRET = 'texto-privado-del-usuario'
const AMOUNT = '987.65'

let logged: string[] = []
beforeEach(() => {
  logged = []
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map((a) => String(a)).join(' '))
    })
  }
})
afterEach(() => jest.restoreAllMocks())

const everything = () => logged.join('\n')

describe('log-safe helpers', () => {
  it('safeErrorCode never returns the message', () => {
    expect(safeErrorCode(Object.assign(new Error(SECRET), { status: 429 }))).toBe('status_429')
    expect(safeErrorCode(Object.assign(new Error(SECRET), { code: 'ECONNRESET' }))).toBe('ECONNRESET')
    expect(safeErrorCode(new TypeError(SECRET))).toBe('TypeError')
    expect(safeErrorCode(SECRET)).toBe('error')
    expect(safeErrorCode(undefined)).toBe('error')
  })

  it('statusFromMessage extracts only the number', () => {
    expect(statusFromMessage(new Error(`[402 Payment Required] ${SECRET}`))).toBe('status_402')
    expect(statusFromMessage(new Error(SECRET))).toBeNull()
  })

  it('reasonCode drops the value after the colon', () => {
    expect(reasonCode(`ungrounded_number:${AMOUNT}`)).toBe('ungrounded_number')
    expect(reasonCode(undefined)).toBe('unknown')
  })
})

describe('no message text, amounts or raw error bodies in logs', () => {
  it('long-term memory (store and retrieve)', async () => {
    const svc = new LongTermMemoryService({ rankAndTrim: () => [] } as never)
    await svc.retrieveRelevantMemories('user-1', SECRET)
    await svc.storeMemory('user-1', SECRET, 'preference' as never)
    expect(logged.length).toBeGreaterThan(0)
    expect(everything()).not.toContain(SECRET)
    expect(everything()).not.toContain('user-1') // only a hash of the user id
  })

  it('memory ranking', () => {
    const svc = new MemoryRankingService({ applyDecay: (s: number) => s } as never)
    svc.rankAndTrim(
      [{ id: 'm1', content: SECRET, type: 'preference', relevanceScore: 1, timestamp: new Date(), importanceScore: 1 } as never],
      2000,
    )
    expect(everything()).not.toContain(SECRET)
  })

  it('AIService: provider failures log a code and the aggregated error has no body', async () => {
    const config = { get: (k: string, d?: string) => ({ GEMINI_API_KEY: 'x', AI_PROVIDER: 'gemini' } as Record<string, string>)[k] ?? d }
    const failing = { generateResponse: jest.fn(async () => { throw Object.assign(new Error(`${SECRET} ${AMOUNT}`), { status: 500 }) }) }
    const unused = { generateResponse: jest.fn(async () => { throw new Error(`${SECRET} again`) }) }
    const memory = { retrieveRelevantMemories: jest.fn(async () => []), storeExchange: jest.fn() }
    const ai = new AIService(config as never, memory as never, unused as never, unused as never, unused as never, failing as never)

    let thrown: Error | undefined
    try {
      await ai.processMessage({ message: 'hola' } as never)
    } catch (e) {
      thrown = e as Error
    }
    expect(thrown).toBeDefined()
    expect(thrown!.message).not.toContain(SECRET)
    expect(thrown!.message).not.toContain(AMOUNT)
    expect(everything()).not.toContain(SECRET)
    expect(everything()).not.toContain(AMOUNT)
    expect(everything()).toContain('status_500')
  })

  const facts = {
    intent: 'spending_summary',
    period: { from: '2026-10-01', to: '2026-10-31' },
    currency: 'PEN',
    figures: { income: 4500, expenses: 120.5, available: 4379.5, txn_count: 2 },
    items: [],
    txnCount: 2,
    confidence: 'high',
    evidenceTxnIds: [],
    context: { periodLabel: 'octubre 2026', granularity: 'month', hasHistory: true },
    engineVersion: 'test',
  } as unknown as FactsPayload

  it('NinaRouter: a rejected figure is logged by code only', async () => {
    const ai = { processMessage: jest.fn(async () => JSON.stringify({ message: `Gastaste S/ ${AMOUNT}`, figures_used: [], follow_ups: [] })) }
    const router = new NinaRouterService(ai as never)
    const res = await router.explainFacts('user-1', 'cuánto gasté', facts)
    expect(res.usedLlm).toBe(false) // fail-closed fallback still works
    expect(everything()).toContain('ungrounded_number')
    expect(everything()).not.toContain(AMOUNT)
  })

  it('NinaRouter: a provider error is logged by code only', async () => {
    const ai = { processMessage: jest.fn(async () => { throw Object.assign(new Error(`${SECRET} ${AMOUNT}`), { status: 503 }) }) }
    const router = new NinaRouterService(ai as never)
    const res = await router.explainFacts('user-1', 'cuánto gasté', facts)
    expect(res.usedLlm).toBe(false)
    expect(everything()).toContain('status_503')
    expect(everything()).not.toContain(SECRET)
    expect(everything()).not.toContain(AMOUNT)
  })
})
