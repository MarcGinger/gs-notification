import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { withTimeout } from '../timeout.helper';
import { isOk, isErr } from 'src/shared/errors';
import { HealthCheckHelper } from '../utils/health-check.helper';
import { HealthCheckDetails } from '../types/health.types';
import { IO_REDIS } from 'src/shared/constants/injection-tokens';

/**
 * Redis Health Indicator for NestJS Terminus
 *
 * Uses Result pattern for health check operations with intentional fallback throws:
 * - Primary logic uses Result<T, E> for structured error handling
 * - Fallback throws only occur when Result helper methods themselves fail (infrastructure-level failures)
 * - NestJS Terminus expects either successful HealthIndicatorResult or thrown exceptions
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(IO_REDIS) private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async ping(key = 'redis', timeoutMs = 1000): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const context = {
      service: 'redis',
      key,
    };

    // Perform Redis ping using the helper
    const pingResult = await HealthCheckHelper.safeHealthCheck(
      async () => {
        return await withTimeout(this.redis.ping(), timeoutMs);
      },
      { ...context, endpoint: 'ping' },
    );

    if (isErr(pingResult)) {
      const errorMessage = HealthCheckHelper.getErrorMessage(pingResult.error);
      const unhealthyResult = HealthCheckHelper.createUnhealthyResult(
        this.healthIndicatorService,
        key,
        errorMessage,
        context,
      );

      if (isOk(unhealthyResult)) {
        return unhealthyResult.value;
      }
      // INTENTIONAL THROW: Fallback when Result helper methods fail - NestJS Terminus expects exceptions for infrastructure failures
      throw new Error(`Redis ping failed: ${errorMessage}`);
    }

    // Validate ping response
    const validationResult = HealthCheckHelper.validateRedisPingResponse(
      pingResult.value,
      { ...context, endpoint: 'ping' },
    );

    if (isErr(validationResult)) {
      const errorMessage = HealthCheckHelper.getErrorMessage(
        validationResult.error,
      );
      const unhealthyResult = HealthCheckHelper.createUnhealthyResult(
        this.healthIndicatorService,
        key,
        errorMessage,
        context,
      );

      if (isOk(unhealthyResult)) {
        return unhealthyResult.value;
      }
      // INTENTIONAL THROW: Fallback when Result helper methods fail - NestJS Terminus expects exceptions for infrastructure failures
      throw new Error(`Redis ping validation failed: ${errorMessage}`);
    }

    // All checks passed
    const responseTime = Date.now() - startTime;
    const healthyResult = HealthCheckHelper.createHealthyResult(
      this.healthIndicatorService,
      key,
      {
        response: 'PONG',
        responseTime,
      },
    );

    if (isOk(healthyResult)) {
      return healthyResult.value;
    }

    // INTENTIONAL THROW: Fallback when Result helper methods fail - NestJS Terminus expects exceptions for infrastructure failures
    const errorMessage = HealthCheckHelper.getErrorMessage(healthyResult.error);
    throw new Error(`Failed to create health result: ${errorMessage}`);
  }

  async getDetailedInfo(): Promise<HealthCheckDetails> {
    const startTime = Date.now();
    const context = {
      service: 'redis',
    };

    try {
      // Get Redis ping and info using the helper
      const pingResult = await HealthCheckHelper.safeHealthCheck(
        async () => {
          return await withTimeout(this.redis.ping(), 1000);
        },
        { ...context, endpoint: 'ping' },
      );

      if (isErr(pingResult)) {
        return {
          status: 'unhealthy',
          error: HealthCheckHelper.getErrorMessage(pingResult.error),
        };
      }

      // Validate ping response
      const pingValidation = HealthCheckHelper.validateRedisPingResponse(
        pingResult.value,
        { ...context, endpoint: 'ping' },
      );

      if (isErr(pingValidation)) {
        return {
          status: 'unhealthy',
          error: HealthCheckHelper.getErrorMessage(pingValidation.error),
        };
      }

      // Get Redis info (non-critical)
      const infoResult = await HealthCheckHelper.safeHealthCheck(
        async () => {
          return await withTimeout(this.redis.info(), 1000);
        },
        { ...context, endpoint: 'info' },
      );

      const responseTime = Date.now() - startTime;

      // Parse Redis info if available
      let parsedInfo = {};
      if (isOk(infoResult)) {
        const info = infoResult.value;
        if (typeof info === 'string') {
          const lines = info.split('\r\n');
          parsedInfo = lines
            .filter((line) => line.includes(':'))
            .reduce(
              (acc, line) => {
                const [key, value] = line.split(':');
                if (key && value) {
                  // Focus on important metrics
                  if (
                    [
                      'redis_version',
                      'connected_clients',
                      'used_memory_human',
                      'keyspace_hits',
                      'keyspace_misses',
                    ].includes(key)
                  ) {
                    acc[key] = value;
                  }
                }
                return acc;
              },
              {} as Record<string, string>,
            );
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: {
          ping: 'PONG',
          connection: 'active',
          ...parsedInfo,
          ...(isErr(infoResult) && {
            infoError: HealthCheckHelper.getErrorMessage(infoResult.error),
          }),
        },
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        error: (err as Error)?.message || 'Unknown error occurred',
      };
    }
  }
}
