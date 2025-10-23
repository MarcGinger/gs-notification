import {
  Result,
  ok,
  err,
  fromError,
  withContext,
  DomainError,
} from 'src/shared/errors';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { HealthErrors, HealthContext } from '../errors/health.errors';
import { TerminusHealthResult } from '../types/health.types';

/**
 * Helper utilities for health check implementations
 */
export class HealthCheckHelper {
  /**
   * Wraps a health check operation with error handling and converts exceptions to domain errors
   */
  static async safeHealthCheck<T>(
    operation: () => Promise<T>,
    context: HealthContext,
  ): Promise<Result<T, DomainError>> {
    try {
      const result = await operation();
      return ok(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return err(
          withContext(HealthErrors.HEALTH_CHECK_TIMEOUT, {
            ...context,
            cause: error.message,
          }),
        );
      }

      return err(fromError(HealthErrors.SERVICE_UNAVAILABLE, error, context));
    }
  }

  /**
   * Creates a successful Terminus health result
   */
  static createHealthyResult(
    healthIndicatorService: HealthIndicatorService,
    key: string,
    details?: Record<string, any>,
  ): TerminusHealthResult {
    try {
      // Call the Terminus fluent API directly. This mirrors how other
      // indicators (e.g. Postgres) interact with the service and avoids
      // fragile runtime shape introspection.
      // Narrow to unknown then assert the runtime shape we expect.
      const terminus = healthIndicatorService as unknown as {
        check: (k: string) => {
          up: (d: Record<string, unknown>) => HealthIndicatorResult;
        };
      };

      const result = terminus
        .check(key)
        .up(details || ({} as Record<string, unknown>));

      return ok(result);
    } catch (error) {
      return err(
        fromError(
          HealthErrors.INVALID_HEALTH_RESPONSE,
          error as unknown as Error,
          {
            key,
            details,
          },
        ),
      );
    }
  }

  /**
   * Creates a failed Terminus health result
   */
  static createUnhealthyResult(
    healthIndicatorService: HealthIndicatorService,
    key: string,
    error: string,
    context?: HealthContext,
  ): TerminusHealthResult {
    try {
      const result = healthIndicatorService.check(key).down({ error });
      return ok(result);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- Reason: Mapping runtime error from health indicator down() into DomainError is intentional. Ticket: TICKET-REQUIRED
      return err(
        fromError(
          HealthErrors.INVALID_HEALTH_RESPONSE,
          err as unknown as Error,
          {
            key,
            originalError: error,
            ...context,
          },
        ),
      );
    }
  }

  /**
   * Validates that a decision response contains the expected result
   */
  static validateDecisionResult(
    response: unknown,
    expectedResult: unknown = true,
    context: HealthContext,
  ): Result<boolean, DomainError> {
    let actualResult: unknown = undefined;
    if (
      typeof response === 'object' &&
      response !== null &&
      'data' in response
    ) {
      const resp = response as { data?: unknown };
      if (
        typeof resp.data === 'object' &&
        resp.data !== null &&
        'result' in resp.data
      ) {
        // Accessing dynamic nested field after runtime checks
        actualResult = (resp.data as Record<string, unknown>)['result'];
      }
    }

    // Safely extract response.data for error context
    let responseData: unknown = undefined;
    if (
      typeof response === 'object' &&
      response !== null &&
      'data' in response
    ) {
      responseData = (response as { data?: unknown }).data;
    }

    if (actualResult !== expectedResult) {
      return err(
        withContext(HealthErrors.OPA_DECISION_PROBE_FAILED, {
          ...context,
          expectedResult,
          actualResult,
          response: responseData,
        }),
      );
    }

    return ok(true);
  }

  /**
   * Safely extracts error message from domain error
   */
  static getErrorMessage(error: DomainError): string {
    return error.detail || error.title || 'Unknown error';
  }

  /**
   * Validates Redis ping response
   */
  static validateRedisPingResponse(
    response: unknown,
    context: HealthContext,
  ): Result<boolean, DomainError> {
    if (response !== 'PONG') {
      return err(
        withContext(HealthErrors.REDIS_UNEXPECTED_PING_RESPONSE, {
          ...context,
          expectedResponse: 'PONG',
          actualResponse: String(response),
        }),
      );
    }

    return ok(true);
  }
}
