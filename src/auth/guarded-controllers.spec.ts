import { GUARDS_METADATA } from '@nestjs/common/constants'
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { ChatController } from '../chat/chat.controller'
import { ExpensesController } from '../expenses/expenses.controller'
import { FinanceEngineController } from '../finance-engine/finance-engine.controller'
import { TransactionsController } from '../transactions/transactions.controller'
import { SpacesController } from '../spaces/spaces.controller'
import { ConsentsController } from '../consents/consents.controller'
import { MeController } from '../me/me.controller'
import { AccountsController } from '../accounts/accounts.controller'

// Every HTTP controller that touches user data must be guarded by the JWT guard.
describe('controller guards', () => {
  it.each([
    ChatController,
    ExpensesController,
    FinanceEngineController,
    TransactionsController,
    SpacesController,
    ConsentsController,
    MeController,
    AccountsController,
  ])('%p is guarded by SupabaseAuthGuard', (controller) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? []
    expect(guards).toContain(SupabaseAuthGuard)
  })
})
