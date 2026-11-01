import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Request, UseFilters, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { localToday, setAsideByGoal } from '../../packages/finance-engine/src'
import { ApiExceptionFilter } from '../common/api-exception.filter'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { FinanceEngineService } from '../finance-engine/finance-engine.service'
import { GoalService, parseContribution } from './goal.service'
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
    const contributions = setAsideByGoal(txs)
    return { goals: rows.map((row) => goalPlanView(row, txs, asOf, contributions)) }
  }

  /**
   * HOME-02: "aparté S/ 200 para Japón". Records a movement linked to the goal; Nina never moves
   * money. The goal must be one of the caller's active goals (checked here and by RLS).
   */
  @Post(':id/contributions')
  @HttpCode(201)
  async contribute(
    @Request() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) goalId: string,
    @Body() body: unknown,
  ) {
    const asOf = localToday(new Date())
    const input = parseContribution(body, asOf)
    if (typeof input === 'string') throw new BadRequestException(input)
    const goal = await this.goals.addContribution(req.user.id, goalId, input)
    const txs = await this.engine.loadTransactions(req.user.id)
    return { goal: goalPlanView(goal, txs, asOf) }
  }

  /** HOME-04: "saqué S/ 200 de Japón". Never more than the goal holds, computed by the engine. */
  @Post(':id/withdrawals')
  @HttpCode(201)
  async withdraw(
    @Request() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) goalId: string,
    @Body() body: unknown,
  ) {
    const asOf = localToday(new Date())
    const input = parseContribution(body, asOf)
    if (typeof input === 'string') throw new BadRequestException(input)
    const goal = await this.goals.getActive(req.user.id, goalId)
    const before = await this.engine.loadTransactions(req.user.id)
    if (input.amount > goalPlanView(goal, before, asOf).currentAmount) {
      throw new BadRequestException('amount exceeds what the goal holds')
    }
    await this.goals.addWithdrawal(req.user.id, goal, input)
    const txs = await this.engine.loadTransactions(req.user.id)
    return { goal: goalPlanView(goal, txs, asOf) }
  }
}
