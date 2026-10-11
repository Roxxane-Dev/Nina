import { NotFoundException } from '@nestjs/common'
import { ConfirmationTokens } from '../confirmation-token'
import { ConfirmationHandler } from './confirmation.handler'
import { RegisterExpenseHandler } from './registration.handlers'
import type { ChatContext } from './handler'

const ctx = (message: string, pendingToken?: string): ChatContext =>
  ({ userId: 'u1', message, pendingToken, asOf: new Date(), question: {} as never })

function setup(spaces: Array<{ id: string; name: string }>, member = true) {
  const tokens = new ConfirmationTokens('t')
  const expenses = {
    buildPendingFromMessage: jest.fn(async () => ({
      text: 'Voy a registrar:\n• S/ 1,200.00 en Hogar\n\n¿Confirmas?',
      items: [{ amount: 1200, category_slug: 'home' }],
    })),
    insertExpenses: jest.fn(async () => ({ result: 'Listo, gastos registrados ✅' })),
    updateUserProfile: jest.fn(async () => null),
  }
  const spacesSvc = {
    listMineOrEmpty: jest.fn(async () => spaces),
    assertMember: jest.fn(async () => {
      if (!member) throw new NotFoundException()
      return 'member'
    }),
  }
  return {
    register: new RegisterExpenseHandler(tokens, expenses as never, spacesSvc as never),
    confirm: new ConfirmationHandler(tokens, expenses as never, {} as never, {} as never, spacesSvc as never),
    expenses,
    spacesSvc,
  }
}

describe('US-35: registering a shared expense from the chat', () => {
  it('"es de la casa" goes to the space after confirmation', async () => {
    const t = setup([{ id: 'space-1', name: 'Casa' }])
    const ask = await t.register.handle(ctx('pagué 1200 de alquiler, es de la casa'))
    expect(ask?.reply.reply).toContain('Irá al espacio compartido «Casa».')
    const done = await t.confirm.handle(ctx('sí', ask?.reply.pendingToken))
    expect(t.spacesSvc.assertMember).toHaveBeenCalledWith('u1', 'space-1')
    expect(t.expenses.insertExpenses).toHaveBeenCalledWith(expect.any(Array), 'u1', 'space-1')
    expect(done?.reply.reply).toContain('Quedó en el espacio «Casa».')
  })

  it('without a space reference it stays personal', async () => {
    const t = setup([{ id: 'space-1', name: 'Casa' }])
    const ask = await t.register.handle(ctx('gasté 25 en taxi'))
    expect(ask?.reply.reply).not.toContain('espacio')
    await t.confirm.handle(ctx('sí', ask?.reply.pendingToken))
    expect(t.expenses.insertExpenses).toHaveBeenCalledWith(expect.any(Array), 'u1', undefined)
  })

  it('with several spaces and a generic phrase it asks which one and defaults to personal', async () => {
    const t = setup([{ id: 's1', name: 'Casa' }, { id: 's2', name: 'Familia' }])
    const ask = await t.register.handle(ctx('gasté 1200 en alquiler, es compartido'))
    expect(ask?.reply.reply).toContain('Tienes varios espacios compartidos')
    await t.confirm.handle(ctx('sí', ask?.reply.pendingToken))
    expect(t.expenses.insertExpenses).toHaveBeenCalledWith(expect.any(Array), 'u1', undefined)
  })

  it('if the user left the space before confirming, nothing is saved', async () => {
    const t = setup([{ id: 'space-1', name: 'Casa' }], false)
    const ask = await t.register.handle(ctx('pagué 1200 de alquiler, es de la casa'))
    const done = await t.confirm.handle(ctx('sí', ask?.reply.pendingToken))
    expect(t.expenses.insertExpenses).not.toHaveBeenCalled()
    expect(done?.reply.reply).toContain('Ya no perteneces a ese espacio')
  })
})
