import { BadRequestException, Controller, Get, Query, Request, UseFilters, UseGuards } from '@nestjs/common'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { FinanceEngineService } from './finance-engine.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1')
export class FinanceEngineController {
  constructor(private readonly engine: FinanceEngineService) {}

  /** Inicio / Movimientos / Análisis: period totals, categories, comparison, balance. */
  @Get('overview')
  async overview(@Request() req: AuthedRequest, @Query('period') period?: string) {
    const result = await this.engine.overview(req.user.id, period)
    if (!result) throw new BadRequestException("period must be 'current', 'previous' or 'YYYY-MM' (not in the future)")
    return result
  }

  /** Análisis: income and expenses for the last N months (default 6, max 12). */
  @Get('trends')
  async trends(@Request() req: AuthedRequest, @Query('months') months?: string) {
    const n = months === undefined ? 6 : Number(months)
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new BadRequestException('months must be an integer 1–12')
    return { points: await this.engine.trends(req.user.id, n) }
  }

  @Get('summary')
  async summary(@Request() req: AuthedRequest) {
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
  async score(@Request() req: AuthedRequest) {
    const bundle = await this.engine.computeBundle(req.user.id)
    return bundle.score
  }

  @Get('forecast')
  async forecast(@Request() req: AuthedRequest) {
    const bundle = await this.engine.computeBundle(req.user.id)
    return bundle.forecast
  }
}
