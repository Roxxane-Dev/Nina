import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FinancialLedgerService } from '../financial-ledger/financial-ledger.service';
import { HomeIntelligenceService } from '../home/home-intelligence.service';
import { IntelligenceCacheService } from '../cache/intelligence-cache.service';
import { AIObservabilityService } from '../ai/observability/ai-observability.service';

@Injectable()
export class NightlyIntelligenceJob {
  private readonly logger = new Logger(NightlyIntelligenceJob.name);

  constructor(
    private readonly ledger: FinancialLedgerService,
    private readonly homeIntelligence: HomeIntelligenceService,
    private readonly cacheService: IntelligenceCacheService,
    private readonly observability: AIObservabilityService,
  ) {}

  /**
   * Runs nightly to precompute intelligence snapshots for all users.
   * Also exposed as a manual trigger via runForUser().
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runNightlyPipeline() {
    this.logger.log('[NIGHTLY JOB START] Initiating financial intelligence evolution.');
    const jobStartTime = Date.now();

    // Idempotency: skip if already ran today
    const jobKey = `job:nightly:${new Date().toISOString().split('T')[0]}`;
    const alreadyRan = await this.cacheService.get(jobKey);
    if (alreadyRan) {
      this.logger.warn('[NIGHTLY JOB] Already executed today. Skipping.');
      return;
    }

    let usersProcessed = 0;
    let errors = 0;

    try {
      // ── REAL users from DB (Bug fix: was hardcoded 'user-1') ──────────────
      const userIds = await this.ledger.getAllUsersWithData();
      this.logger.log(`[NIGHTLY JOB] Found ${userIds.length} users to process.`);

      for (const userId of userIds) {
        try {
          await this.processUser(userId);
          usersProcessed++;
        } catch (err: any) {
          errors++;
          this.logger.error(`[NIGHTLY JOB] Failed for userId=${userId}: ${err.message}`);
        }
      }

      // Mark job done for today
      await this.cacheService.set(jobKey, true, 24 * 60 * 60);

      const totalLatency = Date.now() - jobStartTime;
      this.logger.log(
        `[JOB COMPLETED] Processed ${usersProcessed} users. Errors: ${errors}. Latency: ${totalLatency}ms.`,
      );
    } catch (err: any) {
      this.logger.error(`[NIGHTLY JOB CRITICAL FAILURE] ${err.message}`);
    }
  }

  /**
   * Process a single user: generate snapshot and persist to DB + cache.
   */
  async processUser(userId: string): Promise<void> {
    const start = Date.now();
    this.logger.log(`[USER ANALYZED] Starting pipeline for userId=${userId}`);

    // Generate home snapshot from real ledger data
    const snapshot = await this.homeIntelligence.generateHomeSnapshot(userId);

    // Persist to DB (Bug fix: was a commented-out stub)
    await this.homeIntelligence.persistSnapshot(userId, snapshot);

    // Populate cache for instant home screen response
    await this.cacheService.setHomeSnapshot(userId, snapshot);

    try {
      await this.observability.trackIntervention(userId, 'nightly_snapshot', 'positive');
    } catch {
      // Observability is non-critical
    }

    const latency = Date.now() - start;
    this.logger.log(
      `[SNAPSHOT GENERATED] userId=${userId} netWorth=${snapshot.netWorth} healthScore=${snapshot.financialHealth.score} latency=${latency}ms`,
    );
  }

  /**
   * Manual trigger: run pipeline for a single user immediately.
   * Useful for post-expense-confirmation refresh.
   */
  async runForUser(userId: string): Promise<void> {
    this.logger.log(`[NIGHTLY JOB] Manual trigger for userId=${userId}`);
    await this.processUser(userId);
  }
}
