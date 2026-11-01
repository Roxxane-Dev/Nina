import { BadRequestException, Body, Controller, Get, HttpCode, Post, Request, UseFilters, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { buildNudges, contributedInMonth, localToday, MAX_NUDGES } from '../../packages/finance-engine/src'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { FinanceEngineService } from '../finance-engine/finance-engine.service'
import { GoalService } from '../goals/goal.service'
import { goalPlanView } from '../goals/goal-plans'
import { NudgesService } from './nudges.service'

type AuthedRequest = ExpressRequest & { user: SupabaseUser }

/** Avisos de Nina (NOTIF-01). Computed by the engine on read; userId always from the JWT. */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller('v1/nudges')
export class NudgesController {
  constructor(
    private readonly nudges: NudgesService,
    private readonly goals: GoalService,
    private readonly engine: FinanceEngineService,
  ) {}

  @Get()
  async list(@Request() req: AuthedRequest) {
    const userId = req.user.id
    const asOf = localToday(new Date())
    const [txs, rows, dismissed] = await Promise.all([
      this.engine.loadTransactions(userId),
      this.goals.listActive(userId),
      this.nudges.dismissedKeys(userId),
    ])
    const goals = rows.map((row) => ({
      id: row.id,
      name: row.name,
      remaining: goalPlanView(row, txs, asOf).remaining,
      contributedThisMonth: contributedInMonth(txs, row.id, asOf),
    }))
    return { nudges: buildNudges({ txs, asOf, goals }).filter((n) => !dismissed.has(n.key)).slice(0, MAX_NUDGES) }
  }

  @Post('dismiss')
  @HttpCode(204)
  async dismiss(@Request() req: AuthedRequest, @Body() body: { key?: unknown }) {
    const key = typeof body?.key === 'string' ? body.key.trim() : ''
    if (!key || key.length > 120) throw new BadRequestException('invalid key')
    await this.nudges.dismiss(req.user.id, key)
  }
}
