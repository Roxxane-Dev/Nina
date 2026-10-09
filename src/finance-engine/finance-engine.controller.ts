import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { FinanceEngineService } from './finance-engine.service'

@UseGuards(SupabaseAuthGuard)
@Controller('v1')
export class FinanceEngineController {
  constructor(private readonly engine: FinanceEngineService) {}

  @Get('summary')
  async summary(@Request() req: ExpressRequest & { user: SupabaseUser }) {
    const bundle = await this.engine.computeBundle(req.user.id)
    return {
      score: bundle.score.score,
      label: bundle.score.label,
      forecast: bundle.forecast,
      recurring: bundle.recurring,
      engineVersion: bundle.score.engineVersion,
    }
  }

  @Get('score')
  async score(@Request() req: ExpressRequest & { user: SupabaseUser }) {
    const bundle = await this.engine.computeBundle(req.user.id)
    return bundle.score
  }

  @Get('forecast')
  async forecast(@Request() req: ExpressRequest & { user: SupabaseUser }) {
    const bundle = await this.engine.computeBundle(req.user.id)
    return bundle.forecast
  }
}
