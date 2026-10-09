import { Injectable, Logger } from '@nestjs/common';
import { ScoredMemory } from './memory.types';
import { MemoryDecayService } from './memory-decay.service';

@Injectable()
export class MemoryRankingService {
  private readonly logger = new Logger(MemoryRankingService.name);

  constructor(private readonly decayService: MemoryDecayService) {}

  /**
   * Ranks and trims memories to fit within the token budget.
   * finalScore = relevanceScore * 0.5 + recencyScore * 0.2 + importanceScore * 0.3
   * effectiveScore = finalScore * decayFactor
   */
  rankAndTrim(memories: ScoredMemory[], maxTokens: number = 2000): ScoredMemory[] {
    this.logger.log(`Ranking ${memories.length} memories for context window.`);

    // 1. Calculate finalScore and effectiveScore for each memory
    const scoredMemories = memories.map(mem => {
      mem.recencyScore = this.calculateRecency(mem.timestamp);
      mem.importanceScore = this.getBaseImportance(mem);
      
      const rawFinalScore = (mem.relevanceScore * 0.5) + (mem.recencyScore * 0.2) + (mem.importanceScore * 0.3);
      mem.finalScore = this.decayService.applyDecay(rawFinalScore, mem.timestamp, mem.type);
      
      return mem;
    });

    // 2. Sort by finalScore descending
    const ranked = scoredMemories.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    // 3. Trim to budget (1 token ~ 4 chars approximation)
    const MAX_CHARS = maxTokens * 4;
    let currentCharCount = 0;
    const trimmed: ScoredMemory[] = [];
    const discarded: ScoredMemory[] = [];

    for (const mem of ranked) {
      const len = mem.content.length;
      if (currentCharCount + len <= MAX_CHARS) {
        trimmed.push(mem);
        currentCharCount += len;
      } else {
        discarded.push(mem);
      }
    }

    // Observability Logging
    this.logger.log(`Selected ${trimmed.length} memories. Discarded ${discarded.length} due to budget.`);
    trimmed.forEach(m => this.logger.debug(`[SELECTED] ID: ${m.id} | Type: ${m.type} | Score: ${m.finalScore?.toFixed(3)} | Content: ${m.content.substring(0, 30)}...`));
    discarded.forEach(m => this.logger.debug(`[TRIMMED] ID: ${m.id} | Type: ${m.type} | Score: ${m.finalScore?.toFixed(3)}`));

    return trimmed;
  }

  private calculateRecency(timestamp: string): number {
    const ageDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
    // Exponential decay scaled to 0.0 - 1.0
    return Math.max(0.0, Math.exp(-0.05 * ageDays));
  }

  private getBaseImportance(memory: ScoredMemory): number {
    // Base importance logic based on memory type
    switch (memory.type) {
      case 'goal':
      case 'behavior':
        return 1.0;
      case 'emotional':
      case 'insight':
      case 'financial':
        return 0.8;
      case 'conversation':
      default:
        // Generic/casual conversations
        return 0.3;
    }
  }
}
