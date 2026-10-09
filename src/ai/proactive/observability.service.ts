import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  /**
   * Tracks KPIs across the intelligence system.
   */
  trackMetric(metric: string, value: any, tags: Record<string, string> = {}) {
    this.logger.log(`[METRIC] ${metric}: ${value} | Tags: ${JSON.stringify(tags)}`);
  }

  trackJobExecution(jobName: string, durationMs: number, status: 'success' | 'failure') {
    this.trackMetric('job_execution', durationMs, { jobName, status });
  }

  trackIntelligenceFreshness(userId: string, ageMinutes: number) {
    this.trackMetric('intelligence_freshness', ageMinutes, { userId });
  }
}
