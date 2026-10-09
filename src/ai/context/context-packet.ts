import { ScoredMemory } from '../memory/memory.types';
import { FinancialHealthSnapshot } from '../analytics/financial-health.types';

export type FinancialHealth = FinancialHealthSnapshot;

export interface BehaviorSignals {
  [key: string]: any;
  weekend_overspending?: boolean;
  stress_spending?: boolean;
  salary_spike_days?: number[];
  late_night_ordering?: boolean;
  food_delivery_dependency?: string;
  savings_consistency?: string;
}



export interface FinancialMetrics {
  trend: 'up' | 'down' | 'stable'
  forecast_end_of_month: number
  budget_status: {
    over_budget: boolean
    remaining: number
  }
  monthlyIncome: number;
  monthlySpent: number;
  currentBalance: number;
}

export interface UserProfile {
  risk_tolerance: string
  spending_behavior: string
  tone_preference: string
  financial_goal: string
  financial_discipline: string
  stress_spending_pattern: boolean
  top_category?: string
  monthly_spending: number
  preferred_coaching_style?: string
  goal_commitment?: string
}

export interface ContextPacket {
  userId: string
  currentMessage: string
  
  // Retrieved context
  memories: ScoredMemory[]
  recentExpenses: any[] // to be typed later with Expense model
  userProfile?: UserProfile
  goals: any[]
  anomalies: any[]
  financialMetrics?: FinancialMetrics
  emotionalSignals: string[]
  activeSubscriptions: any[]
  insights: any[]

  // Phase 2.5 Signals
  behaviorSignals?: BehaviorSignals;
  financialHealth?: FinancialHealth;
  activeRisks?: string[];
  coachingStyle?: string;
}
