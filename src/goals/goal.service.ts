import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { localToday, monthLabelEs, parseGoalRequest, DEFAULT_USD_PEN_RATE, type GoalRequest } from '../../packages/finance-engine/src';
import { createAdminClient } from '../common/supabase.client';
import { usdPenRate } from '../common/usd-rate';
import { FinanceDataUnavailableError } from '../finance-engine/errors';
import type { GoalRow } from './goal-plans';

export type ParsedGoal = {
  name: string;
  /** Always soles: a goal written in dollars is converted at `usd_pen_rate`. */
  target_amount: number;
  /** YYYY-MM-DD, last day of the month the user wants to reach the goal. */
  deadline?: string;
  original_usd?: number;
  usd_pen_rate?: number;
};

/** Questions ("¿cómo alcanzo mi meta?") are plans to build, never goals to register. */
const QUESTION = /\?|\b(c[oó]mo|cu[aá]l|cu[aá]nto|cu[aá]nta|qu[eé]|plan)\b/i;
const GOAL_WORDS = /\b(?:meta|ahorrar|objetivo|juntar)\b/i;

export function parseGoal(message: string, asOf: Date = localToday(new Date()), rate = DEFAULT_USD_PEN_RATE): ParsedGoal | null {
  if (!GOAL_WORDS.test(message) || QUESTION.test(message)) return null;
  const req = parseGoalRequest(message, asOf);
  return req ? goalFromRequest(req, rate) : null;
}

export function goalFromRequest(req: GoalRequest, rate = DEFAULT_USD_PEN_RATE): ParsedGoal {
  const usd = req.currency === 'USD';
  const goal: ParsedGoal = {
    name: req.name,
    target_amount: Math.round((usd ? req.amount * rate : req.amount) * 100) / 100,
  };
  if (usd) {
    goal.original_usd = req.amount;
    goal.usd_pen_rate = rate;
  }
  if (req.deadline) {
    const last = new Date(Date.UTC(req.deadline.year, req.deadline.month + 1, 0));
    goal.deadline = last.toISOString().slice(0, 10);
  }
  return goal;
}

export function goalConfirmationText(goal: ParsedGoal): string {
  const money = `S/ ${goal.target_amount.toFixed(2)}`;
  const usd = goal.original_usd
    ? ` (US$ ${goal.original_usd.toFixed(2)} al tipo de cambio de referencia S/ ${goal.usd_pen_rate})`
    : '';
  const when = goal.deadline
    ? ` para ${monthLabelEs(Number(goal.deadline.slice(0, 4)), Number(goal.deadline.slice(5, 7)) - 1)}`
    : '';
  return `Voy a registrar una meta llamada "${goal.name}" por ${money}${usd}${when}.\n\n¿Confirmas?`;
}

/** After a plan: offer to save the goal. The confirmation (Sí / No) is the signed token on the reply. */
export function goalSaveOffer(goal: ParsedGoal): string {
  return goalConfirmationText(goal)
    .replace('Voy a registrar una meta llamada', '¿Guardo la meta')
    .replace('.\n\n¿Confirmas?', '? Así te sigo el paso.')
}

@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);
  private db!: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY');

    if (url && key) {
      this.db = createAdminClient(url, key);
    }
  }

  async buildPendingFromMessage(
    message: string,
    userId: string,
  ): Promise<{ text: string; goal: ParsedGoal } | null> {
    const parsed = parseGoal(message, localToday(new Date()), usdPenRate(this.config));
    if (!parsed) return null;
    return { text: goalConfirmationText(parsed), goal: parsed };
  }

  async insertGoal(goal: ParsedGoal, userId: string): Promise<{ result: string }> {
    if (!this.db) return { result: 'Meta registrada ✅' };

    const { error: insertErr } = await this.db.from('goals').insert({
      user_id: userId,
      name: goal.name.charAt(0).toUpperCase() + goal.name.slice(1),
      target_amount: goal.target_amount,
      current_amount: 0,
      deadline: goal.deadline ?? null,
      emoji: '🎯',
      status: 'active',
    });

    if (insertErr) throw insertErr;

    return { result: `¡Meta "${goal.name}" registrada exitosamente! 🎯` };
  }

  /** Metas: the user's active goals, newest first. Read with the service role, filtered by user_id. */
  async listActive(userId: string): Promise<GoalRow[]> {
    if (!this.db) return [];
    const { data, error } = await this.db
      .from('goals')
      .select('id, name, target_amount, current_amount, deadline, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      this.logger.error(`listActive failed: ${error.code ?? 'unknown'}`);
      throw new FinanceDataUnavailableError(error.code);
    }
    return (data ?? []) as GoalRow[];
  }
}
