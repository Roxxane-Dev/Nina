import { buildPrompt } from './prompt-builder'
import type { AIInput } from './ai.types'

describe('legacy insights block', () => {
  it('formats money in soles, never with a hard-coded dollar sign', () => {
    const input = {
      message: 'hola',
      insights: {
        monthly_spending: 1250.5,
        previous_month_spending: 900,
        trend: 'up',
        forecast_end_of_month: 1500,
        top_category: 'Comida',
        by_category: { Comida: 640.2 },
      },
    } as unknown as AIInput
    const { system } = buildPrompt(input)
    expect(system).toContain('S/ 1,250.50')
    expect(system).toContain('S/ 640.20')
    expect(system).not.toContain('$')
  })
})
