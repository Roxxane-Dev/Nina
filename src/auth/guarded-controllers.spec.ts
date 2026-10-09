import { GUARDS_METADATA } from '@nestjs/common/constants'
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { ChatController } from '../chat/chat.controller'
import { ExpensesController } from '../expenses/expenses.controller'
import { FinanceEngineController } from '../finance-engine/finance-engine.controller'
import { HomeController } from '../home/home.controller'
import { IntelligenceController } from '../intelligence/intelligence.controller'

// Every HTTP controller that touches user data must be guarded by the JWT guard.
describe('controller guards', () => {
  it.each([
    ChatController,
    ExpensesController,
    FinanceEngineController,
    HomeController,
    IntelligenceController,
  ])('%p is guarded by SupabaseAuthGuard', (controller) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? []
    expect(guards).toContain(SupabaseAuthGuard)
  })
})
