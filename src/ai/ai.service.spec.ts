import { AIService, isPermanentProviderError } from './ai.service'

describe('isPermanentProviderError', () => {
  it.each([
    [{ status: 402 }, true],
    [{ status: 401 }, true],
    [{ status: 429 }, false],
    [{ status: 500 }, false],
    [new Error('[GoogleGenerativeAI Error]: ... [402 Payment Required] credits depleted'), true],
    [new Error('[404 Not Found] model retired'), true],
    [new Error('socket hang up'), false],
  ])('%p → %p', (err, expected) => {
    expect(isPermanentProviderError(err)).toBe(expected)
  })
})

describe('AIService provider cooldown', () => {
  it('skips a provider after a permanent error and uses the next one', async () => {
    const config = { get: (k: string, d?: string) => ({ GEMINI_API_KEY: 'x', OPENAI_API_KEY: 'y', AI_PROVIDER: 'gemini' } as Record<string, string>)[k] ?? d }
    const gemini = { generateResponse: jest.fn(async () => { throw Object.assign(new Error('no credit'), { status: 402 }) }) }
    const openai = { generateResponse: jest.fn(async () => 'ok') }
    const unused = { generateResponse: jest.fn() }
    const memory = { retrieveRelevantMemories: jest.fn(async () => []), storeExchange: jest.fn() }
    const ai = new AIService(config as never, memory as never, unused as never, unused as never, openai as never, gemini as never)

    expect(await ai.processMessage({ message: 'hola' } as never)).toBe('ok')
    expect(await ai.processMessage({ message: 'hola' } as never)).toBe('ok')
    expect(gemini.generateResponse).toHaveBeenCalledTimes(1)
    expect(openai.generateResponse).toHaveBeenCalledTimes(2)
  })
})
