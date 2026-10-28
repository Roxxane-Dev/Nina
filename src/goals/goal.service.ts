import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isoDate, localToday, matchGoal, monthLabelEs, parseContributionRequest, parseGoalRequest, DEFAULT_USD_PEN_RATE, type GoalRequest } from '../../packages/finance-engine/src';
import { createAdminClient } from '../common/supabase.client';
import { usdPenRate } from '../common/usd-rate';
import { formatSoles } from '../common/money';
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
  /** Only the year was given: the deadline is December and the confirmation says so. */
  deadline_year_only?: boolean;
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
    if (req.deadlineYearOnly) goal.deadline_year_only = true;
  }
  return goal;
}

export function goalConfirmationText(goal: ParsedGoal): string {
  const money = formatSoles(goal.target_amount);
  const usd = goal.original_usd
    ? ` (US$ ${goal.original_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} al tipo de cambio de referencia S/ ${goal.usd_pen_rate})`
    : '';
  const when = goal.deadline
    ? ` para ${monthLabelEs(Number(goal.deadline.slice(0, 4)), Number(goal.deadline.slice(5, 7)) - 1)}`
    : '';
  const yearOnly = goal.deadline_year_only ? ' (solo me dijiste el año, así que cuento hasta diciembre; avísame si es antes)' : '';
  return `Voy a registrar una meta llamada "${goal.name}" por ${money}${usd}${when}${yearOnly}.\n\n¿Confirmas?`;
}

/** After a plan: offer to save the goal. The confirmation (Sí / No) is the signed token on the reply. */
export function goalSaveOffer(goal: ParsedGoal): string {
  return goalConfirmationText(goal)
    .replace('Voy a registrar una meta llamada', '¿Guardo la meta')
    .replace('.\n\n¿Confirmas?', '? Así te sigo el paso.')
}

export type ContributionInput = { amount: number; date: string; note: string | null };

const MAX_CONTRIBUTION = 10_000_000;
const MAX_NOTE = 120;

/**
 * Validates POST /v1/goals/:id/contributions. Returns the clean input or the error message.
 * Amount in soles, > 0, at most 2 decimals; date YYYY-MM-DD, not in the future (Lima), default today.
 */
export function parseContribution(body: unknown, today: Date): ContributionInput | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  const amount = typeof b.amount === 'number' ? b.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_CONTRIBUTION) return 'amount must be a positive number';
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    return 'amount must have at most 2 decimals';
  }
  const todayIso = isoDate(today);
  let date = todayIso;
  if (b.date !== undefined && b.date !== null) {
    if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || Number.isNaN(Date.parse(`${b.date}T00:00:00Z`))) {
      return 'date must be YYYY-MM-DD';
    }
    if (b.date > todayIso) return 'date cannot be in the future';
    date = b.date;
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string') return 'note must be text';
    note = b.note.trim().slice(0, MAX_NOTE) || null;
  }
  return { amount: Math.round(amount * 100) / 100, date, note };
}

/** What the chat signs for "aparté 200 para Japón" (re-checked against the goal when confirmed). */
export type PendingContribution = { goalId: string; goalName: string; amount: number; original_usd?: number; usd_pen_rate?: number };

export function contributionConfirmationText(c: PendingContribution): string {
  const usd = c.original_usd
    ? ` (US$ ${c.original_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} al tipo de cambio de referencia S/ ${c.usd_pen_rate})`
    : '';
  return `Voy a anotar ${formatSoles(c.amount)}${usd} apartados para tu meta "${c.goalName}". No cuenta como gasto, pero sale de tu disponible del mes.

¿Confirmas?`;
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

  /**
   * HOME-02 chat: "aparté 200 para Japón". Returns the confirmation to sign, a plain reply when the
   * goal cannot be told (no goals, unknown or ambiguous name), or null when the message is not a
   * contribution.
   */
  async buildContributionFromMessage(
    message: string,
    userId: string,
  ): Promise<{ text: string; contribution: PendingContribution } | { reply: string } | null> {
    const req = parseContributionRequest(message);
    if (!req) return null;
    const goals = await this.listActive(userId);
    const match = matchGoal(req.goalText, goals.map((g) => ({ id: g.id, name: g.name })));
    if ('none' in match) {
      return goals.length
        ? { reply: `No encontré esa meta. Tus metas son: ${goals.map((g) => `"${g.name}"`).join(', ')}. Dime para cuál es, por ejemplo: "aparté 200 para ${goals[0].name}".` }
        : { reply: 'Todavía no tienes metas, así que no tengo dónde anotarlo. Crea una primero, por ejemplo: "quiero ahorrar 2000 para un viaje".' };
    }
    if ('ambiguous' in match) {
      return { reply: `¿Para cuál meta es? ${match.ambiguous.map((g) => `"${g.name}"`).join(', ')}. Dímelo así: "aparté 200 para ${match.ambiguous[0].name}".` };
    }
    const rate = usdPenRate(this.config);
    const usd = req.currency === 'USD';
    const contribution: PendingContribution = {
      goalId: match.goal.id,
      goalName: match.goal.name,
      amount: Math.round((usd ? req.amount * rate : req.amount) * 100) / 100,
      ...(usd ? { original_usd: req.amount, usd_pen_rate: rate } : {}),
    };
    return { text: contributionConfirmationText(contribution), contribution };
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

  /**
   * HOME-02: records a contribution as a personal movement linked to the goal (category 'savings').
   * The goal must belong to the caller and be active; otherwise 404 (never reveals other users' goals).
   * Returns the goal row so the caller can rebuild its progress with the engine.
   */
  async addContribution(userId: string, goalId: string, input: ContributionInput): Promise<GoalRow> {
    if (!this.db) throw new FinanceDataUnavailableError('no_client');
    const { data: goal, error: readErr } = await this.db
      .from('goals')
      .select('id, name, target_amount, current_amount, deadline, status, created_at')
      .eq('id', goalId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (readErr) {
      this.logger.error(`addContribution read failed: ${readErr.code ?? 'unknown'}`);
      throw new FinanceDataUnavailableError(readErr.code);
    }
    if (!goal) throw new NotFoundException('goal not found');

    const { error: insertErr } = await this.db.from('transactions').insert({
      user_id: userId,
      amount: input.amount,
      type: 'expense',
      category: 'savings',
      description: input.note ?? `Apartado · ${(goal as GoalRow).name}`,
      date: input.date,
      source_table: 'manual',
      space_id: 'personal',
      goal_id: goalId,
    });
    if (insertErr) {
      this.logger.error(`addContribution insert failed: ${insertErr.code ?? 'unknown'}`);
      throw new FinanceDataUnavailableError(insertErr.code);
    }
    return goal as GoalRow;
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
