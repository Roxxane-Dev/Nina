export interface IncomeStability {
  score: number; // 0-100
  type: 'stable' | 'irregular' | 'seasonal';
  monthlyAverage: number;
  confidence: number;
  nextExpectedDate?: Date;
}

export interface ExpenseVolatility {
  level: 'low' | 'medium' | 'high';
  standardDeviation: number;
  unusualSpikesCount: number;
  riskImpact: number;
}

export interface SubscriptionBurden {
  score: number; // 0-100
  percentageOfIncome: number;
  count: number;
  optimizationOpportunities: string[];
}

export interface BehavioralRisk {
  score: number; // 0-100
  activeRisks: string[]; // e.g., 'stress_spending', 'impulsive_weekends'
  disciplineTrend: 'improving' | 'stable' | 'declining';
}

export interface EmergencyRunway {
  months: number;
  riskLevel: 'safe' | 'warning' | 'critical';
}

export interface FinancialForecast {
  projectedEndOfMonthBalance: number;
  projectedSavings: number;
  overspendingRisk: 'low' | 'medium' | 'high';
}

export interface FinancialHealthSnapshot {
  userId: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  incomeStability: IncomeStability;
  volatility: ExpenseVolatility;
  subscriptionBurden: SubscriptionBurden;
  behavioralRisk: BehavioralRisk;
  emergencyRunway: EmergencyRunway;
  forecasts: FinancialForecast;
  generatedAt: Date;
}
