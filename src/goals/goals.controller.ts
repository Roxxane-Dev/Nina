import { Controller, Get, Request, UseFilters, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { localToday } from '../../packages/finance-engine/src'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { FinanceEngineService } from '../finance-engine/finance-engine.service'
import { GoalService } from './goal.service'
import { goalPlanView } from './goal-plans'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/goals')
export class GoalsController {
  constructor(
    private readonly goals: GoalService,
    private readonly engine: FinanceEngineService,
  ) {}

  /** Metas: each active goal with its plan (required per month vs. real savings pace) from the engine. */
  @Get()
  async list(@Request() req: AuthedRequest) {
    const rows = await this.goals.listActive(req.user.id)
    if (!rows.length) return { goals: [] }
    const asOf = localToday(new Date())
    const txs = await this.engine.loadTransactions(req.user.id)
    return { goals: rows.map((row) => goalPlanView(row, txs, asOf)) }
  }
}
