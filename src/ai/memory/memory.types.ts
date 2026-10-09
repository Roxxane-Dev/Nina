export type MemoryType =
  | 'conversation'
  | 'financial'
  | 'goal'
  | 'behavior'
  | 'emotional'
  | 'insight';

export interface ScoredMemory {
  id: string;
  content: string;
  type: MemoryType;
  metadata?: Record<string, any>;
  tags?: string[];
  timestamp: string;

  // Scoring
  relevanceScore: number; // 0.0 to 1.0
  recencyScore: number;   // 0.0 to 1.0
  importanceScore: number;// 0.0 to 1.0
  finalScore?: number;    // Computed final score
}
