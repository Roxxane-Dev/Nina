import { StateGraph, END, START } from '@langchain/langgraph';
import { OrchestratorState } from './graph.state';
import { TaskComplexity } from '../llm/provider-router.service';

// We define nodes as pure functions or class methods that receive state and return partial state updates
export const createOrchestratorGraph = (deps: any) => {
  // Define State Graph Channel
  const graphBuilder = new StateGraph<OrchestratorState>({
    channels: {
      userId: { value: (x, y) => y ?? x, default: () => '' },
      originalMessage: { value: (x, y) => y ?? x, default: () => '' },
      contextPacket: { value: (x, y) => y ?? x, default: () => ({} as any) },
      complexity: { value: (x, y) => y ?? x, default: () => 'simple' as TaskComplexity },
      prompt: { value: (x, y) => y ?? x, default: () => '' },
      response: { value: (x, y) => y ?? x, default: () => null },
      error: { value: (x, y) => y ?? x, default: () => null },
      metadata: {
        value: (x, y) => ({ ...x, ...y, nodesVisited: [...(x?.nodesVisited || []), ...(y?.nodesVisited || [])] }),
        default: () => ({ startTime: 0, endTime: 0, nodesVisited: [] })
      },
    }
  }) as any;

  // Nodes
  const initializeContextNode = async (state: any) => {
    // Call services to build initial ContextPacket
    return {
      metadata: { ...state.metadata, nodesVisited: ['initializeContext'] }
    };
  };

  const retrieveMemoriesNode = async (state: any) => {
    // deps.memoryService.retrieve(...)
    return {
      metadata: { ...state.metadata, nodesVisited: ['retrieveMemories'] }
    };
  };

  const promptAssemblyNode = async (state: any) => {
    return {
      prompt: 'Eres Nina, un asistente...',
      metadata: { ...state.metadata, nodesVisited: ['promptAssembly'] }
    };
  };

  const providerSelectionNode = async (state: any) => {
    return {
      complexity: 'simple', // dynamic evaluation
      metadata: { ...state.metadata, nodesVisited: ['providerSelection'] }
    };
  };

  const responseGenerationNode = async (state: any) => {
    // const res = await deps.providerRouter.route(...)
    return {
      response: { text: '¡Hola! Soy Nina.', provider: 'gemini', model: 'gemini-2.0-flash' },
      metadata: { ...state.metadata, nodesVisited: ['responseGeneration'] }
    };
  };

  const persistenceNode = async (state: any) => {
    // save to memory
    return {
      metadata: { ...state.metadata, nodesVisited: ['persistence'] }
    };
  };

  // Add Nodes
  graphBuilder.addNode('initializeContext', initializeContextNode);
  graphBuilder.addNode('retrieveMemories', retrieveMemoriesNode);
  graphBuilder.addNode('promptAssembly', promptAssemblyNode);
  graphBuilder.addNode('providerSelection', providerSelectionNode);
  graphBuilder.addNode('responseGeneration', responseGenerationNode);
  graphBuilder.addNode('persistence', persistenceNode);

  // Add Edges
  graphBuilder.addEdge(START, 'initializeContext');
  graphBuilder.addEdge('initializeContext', 'retrieveMemories');
  graphBuilder.addEdge('retrieveMemories', 'promptAssembly');
  graphBuilder.addEdge('promptAssembly', 'providerSelection');
  graphBuilder.addEdge('providerSelection', 'responseGeneration');
  graphBuilder.addEdge('responseGeneration', 'persistence');
  graphBuilder.addEdge('persistence', END);

  return graphBuilder.compile();
};
