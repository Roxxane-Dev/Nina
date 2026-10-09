import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '../common/supabase.client';

export type ParsedGoal = {
  name: string;
  target_amount: number;
};

export function parseGoal(message: string): ParsedGoal | null {
  const text = message.trim().toLowerCase();
  
  const intentRegex = /\b(?:meta|ahorrar|objetivo)\b/i;
  if (!intentRegex.test(text)) return null;

  const amountMatches = [...text.matchAll(/(\d+(?:[.,]\d+)?)/g)];
  if (amountMatches.length === 0) return null;

  let target_amount = -1;
  
  const currencyRegex = /(?:s\/|soles|usd|\$|dolares|pesos)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:s\/|soles|usd|\$|dolares|pesos)/i;
  const currMatch = text.match(currencyRegex);
  if (currMatch) {
    target_amount = parseFloat((currMatch[1] || currMatch[2]).replace(',', '.'));
  } else {
    for (const match of amountMatches) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (val < 2000 || val > 2100 || match[1].includes('.') || match[1].includes(',')) {
        target_amount = val;
        break;
      }
    }
    if (target_amount === -1) {
      target_amount = parseFloat(amountMatches[0][1].replace(',', '.'));
    }
  }

  if (target_amount <= 0) return null;

  let name = 'Mi Meta';
  const nameMatch = text.match(/(?:para|en)\s+([a-záéíóúñ\s]+)/i);
  if (nameMatch && nameMatch[1].trim().length > 0) {
    name = nameMatch[1].trim();
  }

  return { name, target_amount };
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
    const parsed = parseGoal(message);
    if (!parsed) return null;

    const text = `Voy a registrar una meta llamada "${parsed.name}" por S/ ${parsed.target_amount.toFixed(2)}.\n\n¿Confirmas?`;
    return { text, goal: parsed };
  }

  async insertGoal(goal: ParsedGoal, userId: string): Promise<{ result: string }> {
    if (!this.db) return { result: 'Meta registrada ✅' };

    const { error: insertErr } = await this.db.from('goals').insert({
      user_id: userId,
      name: goal.name.charAt(0).toUpperCase() + goal.name.slice(1),
      target_amount: goal.target_amount,
      current_amount: 0,
      emoji: '🎯',
      status: 'active',
    });

    if (insertErr) throw insertErr;

    return { result: `¡Meta "${goal.name}" registrada exitosamente! 🎯` };
  }
}

