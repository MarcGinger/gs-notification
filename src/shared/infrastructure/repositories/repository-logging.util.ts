/**
 * Repository Logging Utilities - Shared Logging Patterns
 *
 * Provides common logging utilities for repository layers including:
 * - Structured logging context creation
 * - Operation risk assessment
 * - Actor validation with security logging
 * - Correlation ID management
 *
 * @domain Shared Infrastructure
 * @layer Infrastructure - Repository Utilities
 * @pattern Repository Logging Utilities
 */

import { Logger } from 'src/shared/logging';
import { ActorContext } from 'src/shared/application/context';
import { Clock } from 'src/shared/infrastructure/time';
import { Log } from 'src/shared/logging';
import { Result, DomainError, err } from 'src/shared/errors';
import { RepositoryErrorFactory } from 'src/shared/domain/errors/repository.error';

/**
 * Risk levels for repository operations
 */
export type OperationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Configuration for repository logging context
 */
export interface RepositoryLoggingConfig {
  serviceName: string;
  component: string;
}

/**
 * Repository logging utilities for consistent observability patterns
 */
export class RepositoryLoggingUtil {
  /**
   * Creates structured logging context for repository operations
   *
   * @param config - Repository logging configuration
   * @param clock - Clock service for timestamps
   * @param operation - Operation name being performed
   * @param correlationId - Correlation ID for request tracing
   * @param actor - Actor context with user/tenant information
   * @param additionalContext - Additional context fields
   * @returns Structured logging context object
   */
  static createLogContext(
    config: RepositoryLoggingConfig,
    clock: Clock,
    operation: string,
    correlationId: string,
    actor: ActorContext,
    additionalContext?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      serviceName: config.serviceName,
      component: config.component,
      operation,
      correlationId,
      tenant: actor.tenant,
      userId: actor.userId,
      timestamp: clock.nowIso(),
      layer: 'repository',
      ...additionalContext,
    };
  }

  /**
   * Assesses operation risk level based on operation type
   *
   * Risk Assessment Logic:
   * - HIGH: Operations involving deletion or admin actions
   * - MEDIUM: Operations involving updates or modifications
   * - LOW: Read operations and other safe operations
   *
   * @param operation - Operation name to assess
   * @returns Risk level for the operation
   */
  static assessOperationRisk(operation: string): OperationRiskLevel {
    const lowerOp = operation.toLowerCase();

    if (
      lowerOp.includes('delete') ||
      lowerOp.includes('admin') ||
      lowerOp.includes('remove')
    ) {
      return 'HIGH';
    }

    if (
      lowerOp.includes('update') ||
      lowerOp.includes('modify') ||
      lowerOp.includes('create') ||
      lowerOp.includes('write')
    ) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Validates actor context with enhanced security logging
   *
   * Performs tenant ID validation with comprehensive logging for security monitoring.
   * This is a critical security boundary for multi-tenant applications.
   *
   * @param logger - Logger instance for security logging
   * @param actor - Actor context to validate
   * @param logContext - Structured logging context
   * @returns Result indicating validation success or security error
   */
  static validateActorContext(
    logger: Logger,
    actor: ActorContext,
    logContext: Record<string, unknown>,
  ): Result<void, DomainError> {
    if (!actor.tenant) {
      Log.warn(logger, 'Actor validation failed: Missing tenant ID', {
        ...logContext,
        validationError: 'MISSING_TENANT_ID',
        securityRisk: 'HIGH',
        securityEvent: 'unauthorized_access_attempt',
        mitigation: 'request_blocked',
      });

      return err(
        RepositoryErrorFactory.validationError(
          'Tenant ID is required for security isolation',
          'MISSING_TENANT_ID',
        ),
      );
    }

    if (!actor.userId) {
      Log.warn(logger, 'Actor validation failed: Missing user ID', {
        ...logContext,
        validationError: 'MISSING_USER_ID',
        securityRisk: 'MEDIUM',
        securityEvent: 'incomplete_actor_context',
        mitigation: 'request_blocked',
      });

      return err(
        RepositoryErrorFactory.validationError(
          'User ID is required for audit trail',
          'MISSING_USER_ID',
        ),
      );
    }

    // Log successful validation for security monitoring
    Log.info(logger, 'Actor validation successful', {
      ...logContext,
      authDecision: 'allow',
      securityEvent: 'actor_validated',
      tenantIsolation: 'enforced',
    });

    return { ok: true, value: undefined };
  }

  /**
   * Logs authorization success with security context
   *
   * @param logger - Logger instance
   * @param operation - Operation being authorized
   * @param logContext - Structured logging context
   * @param additionalContext - Additional authorization context
   */
  static logAuthorizationSuccess(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    additionalContext?: Record<string, unknown>,
  ): void {
    Log.info(logger, `${operation} authorized`, {
      ...logContext,
      authDecision: 'allow',
      dataAccess: 'authorized',
      securityEvent: 'operation_authorized',
      ...additionalContext,
    });
  }

  /**
   * Logs query performance and data quality metrics
   *
   * @param logger - Logger instance
   * @param operation - Operation name
   * @param logContext - Structured logging context
   * @param metrics - Performance and quality metrics
   */
  static logQueryMetrics(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    metrics: {
      queryTimeMs?: number;
      resultCount?: number;
      dataQuality?: 'good' | 'empty' | 'partial' | 'error';
      sampleData?: unknown;
    },
  ): void {
    Log.info(logger, `${operation} completed successfully`, {
      ...logContext,
      queryResult: 'success',
      ...metrics,
      performanceCategory:
        metrics.queryTimeMs && metrics.queryTimeMs > 1000 ? 'slow' : 'fast',
    });
  }

  /**
   * Logs operation errors with comprehensive context
   *
   * @param logger - Logger instance
   * @param operation - Operation name
   * @param logContext - Structured logging context
   * @param error - Error object
   * @param severity - Impact severity level
   */
  static logOperationError(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    error: Error,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH',
  ): void {
    Log.error(logger, `${operation} failed`, {
      ...logContext,
      error: error.message,
      stack: error.stack,
      errorType: error.constructor.name,
      impactSeverity: severity,
      operationResult: 'failure',
      requiresInvestigation: severity === 'HIGH',
    });
  }
}
