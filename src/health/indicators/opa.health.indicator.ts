import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import axios from 'axios';
import { withTimeout } from '../timeout.helper';
import { isOk, isErr } from 'src/shared/errors';
import { HealthCheckHelper } from '../utils/health-check.helper';
import { HealthCheckDetails } from '../types/health.types';
import { OPA_BASE_URL } from '../../shared/constants/injection-tokens';

/**
 * OPA (Open Policy Agent) Health Indicator for NestJS Terminus
 *
 * Uses Result pattern for health check operations with intentional fallback throws:
 * - Primary logic uses Result<T, E> for structured error handling
 * - Fallback throws only occur when Result helper methods themselves fail (infrastructure-level failures)
 * - NestJS Terminus expects either successful HealthIndicatorResult or thrown exceptions
 */
@Injectable()
export class OpaHealthIndicator {
  constructor(
    @Inject(OPA_BASE_URL) private readonly opaBaseUrl: string,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Prefer /health?bundles&plugins; also do a trivial decision query.
   * Create a tiny policy: `package health\n default allow = true`
   */
  async ping(key = 'opa', timeoutMs = 1500): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const context = {
      service: 'opa',
      baseUrl: this.opaBaseUrl,
      key,
    };

    // Perform health checks using the helper
    const healthCheckResult = await HealthCheckHelper.safeHealthCheck(
      async () => {
        const healthUrl = `${this.opaBaseUrl}/health?bundles=true&plugins=true`;
        return await withTimeout(axios.get(healthUrl), timeoutMs);
      },
      { ...context, endpoint: '/health' },
    );

    if (isErr(healthCheckResult)) {
      const errorMessage = HealthCheckHelper.getErrorMessage(
        healthCheckResult.error,
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
      throw new Error(`Health check failed: ${errorMessage}`);
    }

    // Perform decision probe
    const decisionResult = await HealthCheckHelper.safeHealthCheck(
      async () => {
        const decisionUrl = `${this.opaBaseUrl}/v1/data/health/allow`;
        return await withTimeout(
          axios.post(decisionUrl, { input: {} }),
          timeoutMs,
        );
      },
      { ...context, endpoint: '/v1/data/health/allow' },
    );

    if (isErr(decisionResult)) {
      const errorMessage = HealthCheckHelper.getErrorMessage(
        decisionResult.error,
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
      throw new Error(`Decision probe failed: ${errorMessage}`);
    }

    // Validate decision result
    const validationResult = HealthCheckHelper.validateDecisionResult(
      decisionResult.value,
      true,
      { ...context, endpoint: '/v1/data/health/allow' },
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
      throw new Error(`OPA decision probe failed: ${errorMessage}`);
    }

    // All checks passed
    const responseTime = Date.now() - startTime;
    const healthyResult = HealthCheckHelper.createHealthyResult(
      this.healthIndicatorService,
      key,
      {
        endpoints: ['GET /health', 'POST /v1/data/health/allow'],
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
      service: 'opa',
      baseUrl: this.opaBaseUrl,
    };

    try {
      // Check OPA health endpoint
      const healthResult = await HealthCheckHelper.safeHealthCheck(
        async () => {
          const healthUrl = `${this.opaBaseUrl}/health?bundles=true&plugins=true`;
          return await withTimeout(axios.get(healthUrl), 1500);
        },
        { ...context, endpoint: '/health' },
      );

      if (isErr(healthResult)) {
        return {
          status: 'unhealthy',
          error: HealthCheckHelper.getErrorMessage(healthResult.error),
        };
      }

      // Test decision endpoint
      const decisionResult = await HealthCheckHelper.safeHealthCheck(
        async () => {
          const decisionUrl = `${this.opaBaseUrl}/v1/data/health/allow`;
          return await withTimeout(
            axios.post(decisionUrl, { input: {} }),
            1500,
          );
        },
        { ...context, endpoint: '/v1/data/health/allow' },
      );

      if (isErr(decisionResult)) {
        return {
          status: 'unhealthy',
          error: HealthCheckHelper.getErrorMessage(decisionResult.error),
        };
      }

      // Try to get server info (non-critical)
      const serverInfoResult = await HealthCheckHelper.safeHealthCheck(
        async () => {
          const serverInfoUrl = `${this.opaBaseUrl}/v1/data`;
          return await withTimeout(axios.get(serverInfoUrl), 1500);
        },
        { ...context, endpoint: '/v1/data' },
      );

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: {
          baseUrl: this.opaBaseUrl,
          endpoints: {
            health: {
              status: healthResult.value.status,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Reason: Legacy pattern, healthResult type is dynamic. Ticket: TICKET-REQUIRED
              response: healthResult.value.data,
            },
            decision: {
              status: decisionResult.value.status,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Reason: Legacy pattern, decisionResult type is dynamic. Ticket: TICKET-REQUIRED
              result: decisionResult.value.data?.result,
            },
            serverInfo: {
              status: isOk(serverInfoResult)
                ? serverInfoResult.value.status
                : 'failed',
              ...(isErr(serverInfoResult) && {
                error: HealthCheckHelper.getErrorMessage(
                  serverInfoResult.error,
                ),
              }),
            },
          },
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
