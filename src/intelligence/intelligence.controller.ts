import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { NinaFinanceEngine } from './nina-finance.engine'

@UseGuards(SupabaseAuthGuard)
@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly financeEngine: NinaFinanceEngine) {}

  @Get('snapshot')
  async getSnapshot(
    @Request() req: ExpressRequest & { user: SupabaseUser },
  ) {
    return this.financeEngine.getSnapshot(req.user.id)
  }
}
