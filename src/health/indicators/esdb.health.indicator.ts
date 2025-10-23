import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { KurrentDBClient, START, FORWARDS } from '@kurrent/kurrentdb-client';
import { ESDB_CLIENT } from '../../shared/constants/injection-tokens';

@Injectable()
export class EsdbHealthIndicator {
  constructor(
    @Inject(ESDB_CLIENT) private readonly esdb: KurrentDBClient,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Cheap forward-read to exercise the gRPC channel.
   */
  async ping(key = 'esdb', timeoutMs = 1500): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const startTime = Date.now();
      timer = setTimeout(() => controller.abort(), timeoutMs);

      const read = this.esdb.readAll({
        fromPosition: START,
        direction: FORWARDS,
        maxCount: 1,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of read) break; // touch server once

      const responseTime = Date.now() - startTime;
      return this.healthIndicatorService
        .check(key)
        .up({ op: 'readAll', maxCount: 1, responseTime });
    } catch (err) {
      return this.healthIndicatorService
        .check(key)
        .down({ error: (err as Error)?.message });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async getDetailedInfo(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    details?: Record<string, any>;
    error?: string;
  }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const startTime = Date.now();
      timer = setTimeout(() => controller.abort(), 1500);

      // Try to read a small number of events to test connectivity
      const read = this.esdb.readAll({
        fromPosition: START,
        direction: FORWARDS,
        maxCount: 3,
      });

      let eventCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of read) {
        eventCount++;
      }

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          operation: 'readAll',
          maxCount: 3,
          eventsRead: eventCount,
          connection: 'active',
          transport: 'gRPC',
        },
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        error: (err as Error)?.message,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
