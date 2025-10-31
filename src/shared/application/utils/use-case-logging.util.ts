/**
 * Use Case Logging Utilities - Shared Logging Patterns for Application Layer
 *
 * Provides common logging utilities for use case layers including:
 * - Structured logging context creation with business operation tracking
 * - Command validation and compliance logging
 * - Operation risk assessment for business operations
 * - Performance and audit trail logging
 * - PII compliance and data protection logging
 *
 * @domain Shared Application
 * @layer Application - Use Case Utilities
 * @pattern Use Case Logging Utilities
 */

import { Logger } from 'src/shared/logging';
import { BaseUseCaseCommand } from '../utils/use-case.runner';
import { Clock } from 'src/shared/infrastructure/time';
import { Log } from 'src/shared/logging';
import { Result, DomainError, err } from 'src/shared/errors';
import { DataClassification } from 'src/shared/services/compliance';

/**
 * Risk levels for use case operations
 */
export type UseCaseOperationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Configuration for use case logging context
 */
export interface UseCaseLoggingConfig {
  serviceName: string;
  component: string;
  domain: string;
  entityType: string;
}

/**
 * Compliance operation context for audit trails
 */
export interface ComplianceOperationContext {
  operation: string;
  domain: string;
  entityType: string;
  containsPII: boolean;
  piiCategories?: string[];
  sensitiveFields?: string[];
  protectionApplied?: boolean;
  retentionPolicyApplied?: boolean;
}

/**
 * Use case logging utilities for consistent observability patterns in application layer
 */
export class UseCaseLoggingUtil {
  /**
   * Creates structured logging context for use case operations
   *
   * @param config - Use case logging configuration
   * @param clock - Clock service for timestamps
   * @param operation - Operation name being performed
   * @param command - Use case command with correlation ID and user context
   * @param additionalContext - Additional context fields
   * @returns Structured logging context object
   */
  static createLogContext<TCommand extends BaseUseCaseCommand>(
    config: UseCaseLoggingConfig,
    clock: Clock,
    operation: string,
    command: TCommand,
    additionalContext?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      serviceName: config.serviceName,
      component: config.component,
      domain: config.domain,
      entityType: config.entityType,
      operation,
      correlationId: command.correlationId,
      tenant: command.user.tenant,
      userId: command.user.sub,
      timestamp: clock.nowIso(),
      layer: 'application',
      userRoles: command.user.roles,
      ...additionalContext,
    };
  }

  /**
   * Assesses operation risk level for business operations
   *
   * Risk Assessment Logic:
   * - CRITICAL: Operations involving deletion, admin actions, or bulk operations
   * - HIGH: Operations involving sensitive data updates or financial transactions
   * - MEDIUM: Operations involving data creation or modification
   * - LOW: Read operations and other safe operations
   *
   * @param operation - Operation name to assess
   * @param containsPII - Whether the operation involves PII data
   * @returns Risk level for the operation
   */
  static assessOperationRisk(
    operation: string,
    containsPII: boolean = false,
  ): UseCaseOperationRiskLevel {
    const lowerOp = operation.toLowerCase();

    // Critical operations
    if (
      lowerOp.includes('delete') ||
      lowerOp.includes('admin') ||
      lowerOp.includes('bulk') ||
      lowerOp.includes('mass')
    ) {
      return 'CRITICAL';
    }

    // High risk operations
    if (
      lowerOp.includes('financial') ||
      lowerOp.includes('payment') ||
      lowerOp.includes('transfer') ||
      containsPII
    ) {
      return 'HIGH';
    }

    // Medium risk operations
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
   * Validates use case command with comprehensive logging
   *
   * @param logger - Logger instance
   * @param command - Use case command to validate
   * @param logContext - Structured logging context
   * @returns Result indicating validation success or error
   */
  static validateCommand<TCommand extends BaseUseCaseCommand>(
    logger: Logger,
    command: TCommand,
    logContext: Record<string, unknown>,
  ): Result<void, DomainError> {
    // Validate correlation ID
    if (!command.correlationId) {
      Log.warn(logger, 'Command validation failed: Missing correlation ID', {
        ...logContext,
        validationError: 'MISSING_CORRELATION_ID',
        auditRisk: 'HIGH',
        businessEvent: 'command_validation_failure',
        mitigation: 'request_blocked',
      });

      return err({
        code: 'VALIDATION.MISSING_CORRELATION_ID',
        title: 'Correlation ID is required for request tracing',
        category: 'validation',
        context: { correlationId: command.correlationId },
      });
    }

    // Validate user context
    if (!command.user?.sub) {
      Log.warn(logger, 'Command validation failed: Missing user context', {
        ...logContext,
        validationError: 'MISSING_USER_CONTEXT',
        securityRisk: 'HIGH',
        businessEvent: 'unauthorized_operation_attempt',
        mitigation: 'request_blocked',
      });

      return err({
        code: 'VALIDATION.MISSING_USER_CONTEXT',
        title: 'User context is required for operation',
        category: 'security',
        context: { userId: command.user?.sub },
      });
    }

    // Validate tenant context
    if (!command.user?.tenant) {
      Log.warn(logger, 'Command validation failed: Missing tenant context', {
        ...logContext,
        validationError: 'MISSING_TENANT_CONTEXT',
        securityRisk: 'CRITICAL',
        businessEvent: 'tenant_isolation_violation',
        mitigation: 'request_blocked',
      });

      return err({
        code: 'VALIDATION.MISSING_TENANT_CONTEXT',
        title: 'Tenant context is required for multi-tenant isolation',
        category: 'security',
        context: { tenant: command.user?.tenant },
      });
    }

    Log.info(logger, 'Command validation successful', {
      ...logContext,
      validationResult: 'success',
      businessEvent: 'command_accepted',
      securityValidation: 'passed',
    });

    return { ok: true, value: undefined };
  }

  /**
   * Logs PII compliance check with detailed audit trail
   *
   * @param logger - Logger instance
   * @param operation - Operation name
   * @param logContext - Structured logging context
   * @param classification - PII classification result
   */
  static logComplianceCheck(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    classification: DataClassification,
  ): void {
    const complianceContext: ComplianceOperationContext = {
      operation,
      domain: (logContext.domain as string) || 'unknown',
      entityType: (logContext.entityType as string) || 'unknown',
      containsPII: classification.containsPII,
      piiCategories: classification.piiCategories?.map((cat) => cat.toString()),
      sensitiveFields: classification.sensitiveFields,
    };

    if (classification.containsPII) {
      Log.warn(logger, 'PII detected in business operation', {
        ...logContext,
        complianceCheck: 'pii_detected',
        gdprApplicable: true,
        hipaaApplicable: true,
        businessEvent: 'pii_data_processing',
        dataProtectionRequired: true,
        auditTrailRequired: true,
        ...complianceContext,
      });
    } else {
      Log.info(logger, 'No PII detected in business operation', {
        ...logContext,
        complianceCheck: 'no_pii',
        businessEvent: 'safe_data_processing',
        ...complianceContext,
      });
    }
  }

  /**
   * Logs PII protection application with audit details and retention metadata
   *
   * @param logger - Logger instance
   * @param operation - Operation name
   * @param logContext - Structured logging context
   * @param protectionDetails - Details about protection applied
   */
  static logComplianceProtection(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    protectionDetails: {
      fieldsProtected: number;
      strategiesUsed: string[];
      auditGenerated: boolean;
      retentionApplied: boolean;
      retentionExpiry?: Date;
      legalBasis?: string;
      automaticDeletion?: boolean;
      auditRecord?: string;
    },
  ): void {
    Log.info(logger, 'PII protection and compliance measures applied', {
      ...logContext,
      complianceProtection: 'applied',
      businessEvent: 'data_protection_applied',
      gdprCompliance: 'enforced',
      hipaaCompliance: 'enforced',
      auditTrail: 'generated',
      fieldsProtected: protectionDetails.fieldsProtected,
      strategiesUsed: protectionDetails.strategiesUsed,
      auditGenerated: protectionDetails.auditGenerated,
      retentionApplied: protectionDetails.retentionApplied,
      ...(protectionDetails.retentionExpiry && {
        retentionExpiry: protectionDetails.retentionExpiry.toISOString(),
        dataLifecycle: 'managed',
      }),
      ...(protectionDetails.legalBasis && {
        legalBasis: protectionDetails.legalBasis,
        gdprArticle: 'documented',
      }),
      ...(protectionDetails.automaticDeletion !== undefined && {
        automaticDeletion: protectionDetails.automaticDeletion,
        retentionAutomation: 'configured',
      }),
      ...(protectionDetails.auditRecord && {
        auditRecord: protectionDetails.auditRecord,
        complianceAudit: 'recorded',
      }),
    });
  }

  /**
   * Logs business operation success with performance metrics
   *
   * @param logger - Logger instance
   * @param operation - Operation name
   * @param logContext - Structured logging context
   * @param metrics - Performance and business metrics
   */
  static logOperationSuccess(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    metrics: {
      executionTimeMs?: number;
      aggregateVersion?: number;
      eventCount?: number;
      businessData?: unknown;
    },
  ): void {
    Log.info(logger, `${operation} completed successfully`, {
      ...logContext,
      operationResult: 'success',
      businessEvent: 'operation_completed',
      ...metrics,
      performanceCategory:
        metrics.executionTimeMs && metrics.executionTimeMs > 2000
          ? 'slow'
          : 'fast',
    });
  }

  /**
   * Logs business operation errors with comprehensive context
   *
   * @param logger - Logger instance
   * @param operation - Operation name
   * @param logContext - Structured logging context
   * @param error - Error object or domain error
   * @param severity - Impact severity level
   */
  static logOperationError(
    logger: Logger,
    operation: string,
    logContext: Record<string, unknown>,
    error: Error | DomainError,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH',
  ): void {
    const errorDetails =
      'message' in error
        ? { message: error.message, stack: error.stack }
        : { code: error.code, title: error.title, category: error.category };

    Log.error(logger, `${operation} failed`, {
      ...logContext,
      operationResult: 'failure',
      businessEvent: 'operation_failed',
      impactSeverity: severity,
      requiresInvestigation: severity === 'CRITICAL' || severity === 'HIGH',
      ...errorDetails,
    });
  }
}
