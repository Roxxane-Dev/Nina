import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import {
  ExpensesService,
  type UpdateExpenseInput,
} from './expenses.service'

type AuthReq = ExpressRequest & { user: SupabaseUser }

type CreateExpenseBody = {
  amount: number
  category: string
  description?: string
  date?: string
  source?: string
}

/**
 * REST surface for expense management.
 * All routes guarded — userId always extracted from the verified JWT.
 */
@UseGuards(SupabaseAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /** GET /expenses — list all expenses for the authenticated user */
  @Get()
  listExpenses(@Request() req: AuthReq) {
    return this.expensesService.findByUser(req.user.id)
  }

  /** POST /expenses — create a single expense directly (admin/manual use) */
  @Post()
  createExpense(@Request() req: AuthReq, @Body() body: CreateExpenseBody) {
    return this.expensesService.createExpense(req.user.id, body)
  }

  /** PATCH /expenses/:id — update an existing expense */
  @Patch(':id')
  updateExpense(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() body: UpdateExpenseInput,
  ) {
    return this.expensesService.updateExpense(req.user.id, id, body)
  }
}
