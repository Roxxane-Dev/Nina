import { Injectable, Logger } from '@nestjs/common';
import { MemoryRankingService } from './memory-ranking.service';
import { ScoredMemory, MemoryType } from './memory.types';

@Injectable()
export class LongTermMemoryService {
  private readonly logger = new Logger(LongTermMemoryService.name);

  constructor(
    private readonly rankingService: MemoryRankingService,
    // private readonly vectorStore: VectorStoreService,
  ) {}

  async retrieveRelevantMemories(userId: string, query: string, maxTokens: number = 2000): Promise<ScoredMemory[]> {
    this.logger.log(`Retrieving memories for user ${userId} with query: "${query}"`);

    // 1. Semantic search via pgvector (mocked for now)
    // Here we would get the relevance score from the vector distance
    const semanticMatches: ScoredMemory[] = []; // stub

    // 2. Rank and trim based on decay and importance
    const finalMemories = this.rankingService.rankAndTrim(semanticMatches, maxTokens);

    return finalMemories;
  }

  async storeMemory(userId: string, content: string, type: MemoryType, metadata: any = {}, tags: string[] = []): Promise<void> {
    this.logger.log(`Storing ${type} memory for user ${userId}: ${content}`);
    
    // 1. Generate embedding
    // const embedding = await this.embeddingProvider.embed(content);
    
    // 2. Persist to PostgreSQL with pgvector
    // await this.db.from('memories').insert({ ... })
  }
}
