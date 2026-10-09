import { Injectable, Logger } from '@nestjs/common';
import { ContextPacket } from '../context/context-packet';
import { ProviderRouterService, TaskComplexity } from '../llm/provider-router.service';
import { createOrchestratorGraph } from '../graph/orchestrator.graph';
import { initialOrchestratorState, OrchestratorState } from '../graph/graph.state';

@Injectable()
export class AIOrchestratorService {
  private readonly logger = new Logger(AIOrchestratorService.name);
  private orchestratorGraph: any;

  constructor(
    private readonly providerRouter: ProviderRouterService,
    // dependencies for memory, insights, etc. will go here
  ) {
    this.orchestratorGraph = createOrchestratorGraph({
      providerRouter: this.providerRouter,
    });
  }

  async processUserMessage(userId: string, message: string): Promise<string> {
    this.logger.log(`Orchestrating response for user ${userId} via LangGraph`);

    // 1. Initialize State
    const initialState = initialOrchestratorState();
    initialState.userId = userId;
    initialState.originalMessage = message;

    // 2. Invoke LangGraph
    try {
      const result: OrchestratorState = await this.orchestratorGraph.invoke(initialState);

      this.logger.log(`Graph execution finished. Visited nodes: ${result.metadata.nodesVisited.join(' -> ')}`);

      if (result.error) {
        throw new Error(result.error);
      }

      return result.response?.text || 'No response generated.';
    } catch (error) {
      this.logger.error(`LangGraph execution failed: ${error}`);
      throw error;
    }
  }
}
