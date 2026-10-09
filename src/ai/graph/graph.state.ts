import { ContextPacket } from '../context/context-packet';
import { TaskComplexity } from '../llm/provider-router.service';
import { LLMResponse } from '../llm/llm-provider.interface';

// Define the state of the graph
export interface OrchestratorState {
  userId: string;
  originalMessage: string;
  contextPacket: ContextPacket;
  complexity: TaskComplexity;
  prompt: string;
  response: LLMResponse | null;
  error: string | null;
  metadata: {
    startTime: number;
    endTime: number;
    nodesVisited: string[];
  };
}

export const initialOrchestratorState = (): OrchestratorState => ({
  userId: '',
  originalMessage: '',
  contextPacket: {
    userId: '',
    currentMessage: '',
    memories: [],
    recentExpenses: [],
    goals: [],
    anomalies: [],
    emotionalSignals: [],
    activeSubscriptions: [],
    insights: [],
  },
  complexity: 'simple',
  prompt: '',
  response: null,
  error: null,
  metadata: {
    startTime: Date.now(),
    endTime: 0,
    nodesVisited: [],
  },
});
