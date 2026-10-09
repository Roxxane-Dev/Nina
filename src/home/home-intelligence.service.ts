import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdminClient } from '../common/supabase.client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FinancialLedgerService, type FinancialLedger } from '../financial-ledger/financial-ledger.service';
import { IntelligenceCacheService } from '../cache/intelligence-cache.service';

export interface HomeIntelligencePayload {
  // Patrimonio & financials
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  safeToSpendToday: number;
  runwayMonths: number;
  projectedBalance: number;
  byCategory: Record<string, number>;
  // Health
  financialHealth: {
    score: number;
    trend: string;
    riskLevel: string;
  };
  // AI outputs
  activeAlerts: any[];
  coachingCards: any[];
  behaviorSignals: any[];
  // Activity
  recentActivity: any[];
  goals: any[];
  // Legacy fields
  weeklySummary: {
    spent: number;
    topCategory: string;
    changeVsLastWeek: number;
  };
  notifications: any[];
  generatedAt: string;
}

@Injectable()
export class HomeIntelligenceService implements OnModuleInit {
  private readonly logger = new Logger(HomeIntelligenceService.name);
  private db!: SupabaseClient;

  constructor(
    private readonly cacheService: IntelligenceCacheService,
    private readonly ledger: FinancialLedgerService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL');
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY');
    if (url && key) {
      this.db = createAdminClient(url, key);
      this.logger.log('[HOME] Supabase admin client ready');
    }
  }

  /**
   * Aggregates intelligence for the home screen.
   * Priority: cache → DB snapshot → on-demand calculation (never returns empty).
   */
  async getIntelligence(userId: string): Promise<HomeIntelligencePayload> {
    this.logger.log(`[HOME PAYLOAD] Fetching intelligence for userId=${userId}`);

    // 1. Try cache
    const cached = await this.cacheService.getHomeSnapshot(userId);
    if (cached) {
      this.logger.log(`[HOME PAYLOAD] Cache hit for userId=${userId}`);
      return cached as HomeIntelligencePayload;
    }

    // 2. Try DB snapshot
    const dbSnapshot = await this.getLatestSnapshotFromDB(userId);
    if (dbSnapshot) {
      this.logger.log(`[HOME PAYLOAD] DB snapshot found for userId=${userId}`);
      // Populate cache for next request
      await this.cacheService.setHomeSnapshot(userId, dbSnapshot);
      return dbSnapshot;
    }

    // 3. On-demand calculation (fallback — NEVER return empty)
    this.logger.warn(`[HOME PAYLOAD] No snapshot found — generating on-demand for userId=${userId}`);
    return this.generateOnDemand(userId);
  }

  /**
   * Generates a fresh home snapshot from real DB data.
   * Called on-demand or by the nightly job.
   */
  async generateHomeSnapshot(userId: string): Promise<HomeIntelligencePayload> {
    return this.generateOnDemand(userId);
  }

  private async generateOnDemand(userId: string): Promise<HomeIntelligencePayload> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Fetch ledger data from real DB
    const financials = await this.ledger.getLedger(userId, month);

    // Fetch recent activity (expenses + incomes)
    const recentActivity = await this.fetchRecentActivity(userId);

    // Fetch goals
    const goals = await this.fetchGoals(userId);

    // Financial health score (deterministic)
    const healthScore = this.computeHealthScore(financials);

    const topCategory = Object.entries(financials.byCategory)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'otros';

    const payload: HomeIntelligencePayload = {
      netWorth: financials.netWorth,
      monthlyIncome: financials.totalIncome,
      monthlyExpenses: financials.totalExpenses,
      savingsRate: financials.savingsRate,
      safeToSpendToday: financials.safeToSpendToday,
      runwayMonths: financials.runwayMonths,
      projectedBalance: financials.projectedBalance,
      byCategory: financials.byCategory,
      financialHealth: {
        score: healthScore,
        trend: financials.totalExpenses > financials.totalIncome * 0.9 ? 'warning' : 'stable',
        riskLevel: healthScore > 70 ? 'low' : healthScore > 40 ? 'medium' : 'high',
      },
      activeAlerts: this.generateAlerts(financials),
      coachingCards: this.generateCoachingCards(financials),
      behaviorSignals: [],
      recentActivity,
      goals,
      weeklySummary: {
        spent: financials.totalExpenses,
        topCategory,
        changeVsLastWeek: 0,
      },
      notifications: [],
      generatedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[SNAPSHOT GENERATED] userId=${userId} netWorth=${financials.netWorth} income=${financials.totalIncome} expenses=${financials.totalExpenses}`,
    );

    return payload;
  }

  private computeHealthScore(ledger: FinancialLedger): number {
    let score = 50; // baseline

    // Savings rate bonus (up to +30)
    score += Math.min(30, ledger.savingsRate * 100);

    // Runway bonus (up to +20)
    if (ledger.runwayMonths >= 3) score += 20;
    else if (ledger.runwayMonths >= 1) score += 10;

    // Overspending penalty
    if (ledger.totalExpenses > ledger.totalIncome) score -= 20;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private generateAlerts(ledger: FinancialLedger): any[] {
    const alerts: any[] = [];
    if (ledger.totalExpenses > ledger.totalIncome * 0.9) {
      alerts.push({
        type: 'overspending',
        message: `Llevas gastado S/ ${ledger.totalExpenses.toFixed(2)} de S/ ${ledger.totalIncome.toFixed(2)} este mes.`,
        action_label: 'Ver análisis',
      });
    }
    if (ledger.safeToSpendToday <= 0) {
      alerts.push({
        type: 'budget_exhausted',
        message: 'Has superado tu presupuesto mensual. Tiempo de revisar tus gastos.',
        action_label: 'Ver movimientos',
      });
    }
    return alerts;
  }

  private generateCoachingCards(ledger: FinancialLedger): any[] {
    const cards: any[] = [];
    if (ledger.savingsRate > 0.2) {
      cards.push({
        message: `¡Excelente! Estás ahorrando el ${(ledger.savingsRate * 100).toFixed(0)}% de tus ingresos este mes. 🎉`,
        tone: 'celebratory',
      });
    } else if (ledger.totalIncome === 0) {
      cards.push({
        message: 'Registra tus ingresos para que Nina pueda calcular tu salud financiera real.',
        tone: 'informative',
      });
    } else {
      cards.push({
        message: `Tu tasa de ahorro es ${(ledger.savingsRate * 100).toFixed(0)}%. Lo ideal es al menos 20%.`,
        tone: 'coaching',
      });
    }
    return cards;
  }

  private async fetchRecentActivity(userId: string): Promise<any[]> {
    if (!this.db) return [];
    try {
      const { data, error } = await this.db
        .from('transactions')
        .select('id, amount, description, category, date, type')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []).map((t: any) => ({ ...t, _type: t.type }));
    } catch {
      return [];
    }
  }

  private async fetchGoals(userId: string): Promise<any[]> {
    if (!this.db) return [];
    try {
      const { data, error } = await this.db
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return [];
      return data ?? [];
    } catch {
      return [];
    }
  }

  // ─── DB Snapshot ──────────────────────────────────────────────────────────

  private async getLatestSnapshotFromDB(userId: string): Promise<HomeIntelligencePayload | null> {
    if (!this.db) return null;
    try {
      const { data, error } = await this.db
        .from('intelligence_snapshots')
        .select('payload, created_at')
        .eq('user_id', userId)
        .eq('snapshot_type', 'home_intelligence')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      // Snapshots older than 4 hours are stale — regenerate
      const age = Date.now() - new Date(data.created_at).getTime();
      if (age > 4 * 60 * 60 * 1000) return null;

      return data.payload as HomeIntelligencePayload;
    } catch {
      return null;
    }
  }

  async persistSnapshot(userId: string, payload: HomeIntelligencePayload): Promise<void> {
    if (!this.db) return;
    try {
      const { error } = await this.db.from('intelligence_snapshots').insert({
        user_id: userId,
        snapshot_type: 'home_intelligence',
        payload,
      });
      if (error) {
        this.logger.error(`[SNAPSHOT] Persist failed for ${userId}: ${error.message}`);
      } else {
        this.logger.log(`[SNAPSHOT GENERATED] Persisted for userId=${userId}`);
      }
    } catch (e: any) {
      this.logger.error(`[SNAPSHOT] Persist threw: ${e.message}`);
    }
  }
}
