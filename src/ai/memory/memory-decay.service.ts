import { Injectable, Logger } from '@nestjs/common';
import { MemoryType } from './memory.types';

@Injectable()
export class MemoryDecayService {
  private readonly logger = new Logger(MemoryDecayService.name);

  /**
   * Applies exponential decay: finalScore * Math.exp(-daysSinceCreation / halfLife)
   */
  applyDecay(score: number, timestamp: string, type: MemoryType): number {
    const daysSinceCreation = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const halfLife = this.getHalfLife(type);
    
    const decayFactor = Math.exp(-daysSinceCreation / halfLife);
    const effectiveScore = score * decayFactor;

    return Math.max(0, effectiveScore);
  }

  private getHalfLife(type: MemoryType): number {
    switch (type) {
      case 'conversation':
        return 7; // Fast decay (1 week)
      case 'emotional':
      case 'financial':
        return 30; // Medium decay (1 month)
      case 'insight':
      case 'goal':
        return 180; // Slow decay (6 months)
      case 'behavior':
        return 365; // Very slow decay (1 year)
      default:
        return 30;
    }
  }
}
