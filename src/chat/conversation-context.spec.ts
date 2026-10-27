import { ConfirmationTokens } from './confirmation-token'
import { CONTEXT_TTL_MS, ContextTokens, hasAmount, type ConversationContext } from './conversation-context'
import { completeWithContext } from './chat.service'

describe('ContextTokens', () => {
  const tokens = new ContextTokens('test-secret')
  const ctx: ConversationContext = {
    lastQuestion: '¿Cuánto me queda?',
    lastIntent: 'available',
    awaiting: 'goal_amount',
    draft: 'quiero viajar a japon en enero 2028',
  }

  it('round-trips for the same user', () => {
    const t = tokens.sign('user-a', ctx, 1000)
    expect(tokens.verify(t, 'user-a', 2000)).toEqual(ctx)
  })

  it('rejects another user', () => {
    const t = tokens.sign('user-a', ctx, 1000)
    expect(tokens.verify(t, 'user-b', 2000)).toBeNull()
  })

  it('expires after the TTL', () => {
    const t = tokens.sign('user-a', ctx, 1000)
    expect(tokens.verify(t, 'user-a', 1000 + CONTEXT_TTL_MS - 1)).not.toBeNull()
    expect(tokens.verify(t, 'user-a', 1000 + CONTEXT_TTL_MS)).toBeNull()
  })

  it('rejects a tampered body', () => {
    const t = tokens.sign('user-a', ctx, 1000)
    const [, mac] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ c: { ...ctx, draft: 'otra cosa' }, sub: 'user-a', exp: 9e15 })).toString('base64url')
    expect(tokens.verify(`${forged}.${mac}`, 'user-a', 2000)).toBeNull()
  })

  it('rejects a token signed with another secret', () => {
    const t = new ContextTokens('other-secret').sign('user-a', ctx, 1000)
    expect(tokens.verify(t, 'user-a', 2000)).toBeNull()
  })

  it('rejects oversize tokens and garbage', () => {
    expect(tokens.verify('a'.repeat(4001), 'user-a')).toBeNull()
    expect(tokens.verify('nope', 'user-a')).toBeNull()
    expect(tokens.verify('', 'user-a')).toBeNull()
    expect(tokens.verify(undefined, 'user-a')).toBeNull()
    expect(tokens.verify(null, 'user-a')).toBeNull()
  })

  it('a confirmation token signed with the same secret never passes as a context', () => {
    const confirmations = new ConfirmationTokens('test-secret')
    const pending = confirmations.sign('user-a', { kind: 'income', payload: { income: { amount: 4500, category: 'salary' } } }, 1000)
    expect(tokens.verify(pending, 'user-a', 2000)).toBeNull()
    // And the other way around.
    expect(confirmations.verify(tokens.sign('user-a', ctx, 1000), 'user-a', 2000)).toBeNull()
  })

  it('clips long fields to 300 chars and drops empty ones', () => {
    const t = tokens.sign('user-a', { lastQuestion: 'x'.repeat(5000), draft: '   ', item: 'y'.repeat(301), goalTopic: '  un viaje  ' }, 1000)
    const back = tokens.verify(t, 'user-a', 2000)!
    expect(back.lastQuestion).toHaveLength(300)
    expect(back.item).toHaveLength(300)
    expect(back.draft).toBeUndefined()
    expect(back.goalTopic).toBe('un viaje')
    expect(t.length).toBeLessThan(4000)
  })

  it('needs a secret', () => {
    expect(() => new ContextTokens('')).toThrow()
  })
})

describe('hasAmount', () => {
  it.each([
    ['7000 dolares', true],
    ['cuestan 350 soles', true],
    ['S/ 80', true],
    ['en 2028', false],
    ['no entiendo', false],
  ])('%s → %s', (text, expected) => {
    expect(hasAmount(text)).toBe(expected)
  })
})

describe('completeWithContext', () => {
  it('goal_amount + "7000 dolares" is merged with the original sentence', () => {
    expect(completeWithContext('7000 dolares', { awaiting: 'goal_amount', draft: 'quiero viajar a japon en enero 2028' })).toBe(
      'quiero viajar a japon en enero 2028 7000 dolares',
    )
  })

  it('goal_details + "3000 soles para abril" is merged too', () => {
    expect(completeWithContext('3000 soles para abril', { awaiting: 'goal_details', draft: 'quiero ahorrar para un viaje' })).toBe(
      'quiero ahorrar para un viaje 3000 soles para abril',
    )
  })

  it('expense_amount + "como 80 soles" → "gasté 80 soles en compras"', () => {
    expect(completeWithContext('como 80 soles', { awaiting: 'expense_amount', draft: 'compras' })).toBe('gasté 80 soles en compras')
  })

  it('expense_amount with its own spend verb is left as is', () => {
    expect(completeWithContext('gasté 80 en ropa', { awaiting: 'expense_amount', draft: 'compras' })).toBe('gasté 80 en ropa')
  })

  it('no context, no awaiting, no draft or no amount → unchanged', () => {
    expect(completeWithContext('7000 dolares', null)).toBe('7000 dolares')
    expect(completeWithContext('7000 dolares', undefined)).toBe('7000 dolares')
    expect(completeWithContext('7000 dolares', { lastQuestion: '¿cuánto me queda?' })).toBe('7000 dolares')
    expect(completeWithContext('7000 dolares', { awaiting: 'goal_amount' })).toBe('7000 dolares')
    expect(completeWithContext('no sé todavía', { awaiting: 'goal_amount', draft: 'quiero viajar a japon' })).toBe('no sé todavía')
  })

  it('purchase_price is handled by the conversation handler, not merged', () => {
    expect(completeWithContext('cuestan 350 soles', { awaiting: 'purchase_price', draft: 'x', item: 'unas zapatillas' })).toBe('cuestan 350 soles')
  })
})
