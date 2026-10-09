import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  private healthMetrics = {
    websocketConnections: 0,
    nightlyJobSuccess: true,
    lastJobRun: new Date(),
    providerLatencies: new Map<string, number>(),
  };

  async trackWebsocketConnection(status: 'connect' | 'disconnect') {
    if (status === 'connect') this.healthMetrics.websocketConnections++;
    else this.healthMetrics.websocketConnections = Math.max(0, this.healthMetrics.websocketConnections - 1);
  }

  async recordLatency(operation: string, ms: number) {
    this.healthMetrics.providerLatencies.set(operation, ms);
    if (ms > 1000) {
      this.logger.warn(`[HEALTH] High latency detected for ${operation}: ${ms}ms`);
    }
  }

  getSystemStatus() {
    return {
      status: 'healthy',
      ...this.healthMetrics,
    };
  }
}
