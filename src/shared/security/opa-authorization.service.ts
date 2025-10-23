/**
 * OPA Authorization Service
 *
 * Implementation of AuthorizationPort that integrates with the existing
 * OPA client infrastructure. Provides type-safe permission checking while
 * leveraging all the existing resilience patterns (circuit breaker, metrics,
 * audit logging, etc.).
 */

import { Injectable, Inject } from '@nestjs/common';
// Existing infrastructure
import { OpaClient } from './opa/opa.client';
import { DecisionLoggerService } from './audit/decision-logger.service';
import type { OpaInput } from './opa/opa.types';
import { APP_LOGGER, componentLogger, Logger } from '../logging';
import { Result, DomainError, ok, err } from '../errors/error.types';

// New authorization abstractions
import type {
  AuthorizationPort,
  AuthorizationRequest,
  AuthorizationResult,
  AuthorizationActor,
  AuthorizationContext,
  AuthorizationObligation,
} from './authorization.port';
import {
  createPermissionDeniedError,
  createServiceUnavailableError,
} from './authorization.port';

// Permission utilities
import type { PermissionRegistry } from '../domain/permissions/utils';
import { buildOpaInput } from '../domain/permissions/utils';

const COMPONENT = 'OpaAuthorizationService';

/**
 * OPA-backed authorization service
 *
 * Wraps the existing production-ready OPA client with the AuthorizationPort
 * interface. Maintains all existing resilience patterns while providing
 * type-safe, domain-aware permission checking.
 */
@Injectable()
export class OpaAuthorizationService<P extends string>
  implements AuthorizationPort<P>
{
  private readonly logger: Logger;

  constructor(
    private readonly opaClient: OpaClient,
    private readonly decisionLogger: DecisionLoggerService,
    private readonly permissionRegistry: PermissionRegistry<P>,
    @Inject(APP_LOGGER) moduleLogger: Logger,
  ) {
    this.logger = componentLogger(moduleLogger, COMPONENT);
  }

  /**
   * Check authorization for a single request
   */
  async check(
    request: AuthorizationRequest<P>,
  ): Promise<Result<AuthorizationResult, DomainError>> {
    const startTime = Date.now();

    try {
      // Build OPA input using shared utilities
      const opaInput = this.buildOpaInputFromRequest(request);

      // Determine policy path from permission metadata
      const policyPath = this.resolvePolicyPath(request.permissions[0]);

      // Use existing OPA client with all its resilience patterns
      const decision = await this.opaClient.evaluate(policyPath, opaInput, {
        correlationId: request.context?.correlationId || '',
        tenantId: request.actor.tenantId,
        userId: request.actor.userId,
      });

      const duration = Date.now() - startTime;

      // Convert OPA decision to AuthorizationResult
      const result: AuthorizationResult = {
        allowed: decision.allow,
        reason: decision.reason,
        obligations: this.mapObligations(
          decision.obligations ? [...decision.obligations] : [],
        ),
        metadata: {
          duration,
          policy: policyPath,
          evaluatedAt: new Date().toISOString(),
        },
      };

      // Existing decision logger handles audit with PII protection
      this.decisionLogger.logAuthorizationDecision(opaInput, decision, {
        correlationId: request.context?.correlationId,
        ipAddress: request.context?.ipAddress,
        userAgent: request.context?.userAgent,
      });

      if (!result.allowed) {
        return err(
          createPermissionDeniedError(
            request.domain,
            request.permissions,
            result.reason,
            {
              correlationId: request.context?.correlationId,
              actor: request.actor.userId,
              resource: request.resource?.id,
              policy: policyPath,
            },
          ),
        );
      }

      return ok(result);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error using existing component logger
      this.logger.error('Authorization check failed', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: request.context?.correlationId,
        domain: request.domain,
        permissions: request.permissions,
        duration,
      } as any);

      // Map to domain error
      return err(
        createServiceUnavailableError(
          error instanceof Error ? error.message : 'Unknown error',
          {
            correlationId: request.context?.correlationId,
            domain: request.domain,
            permissions: request.permissions,
            duration,
          },
        ),
      );
    }
  }

  /**
   * Batch authorization checking (optional method)
   */
  async checkBatch(
    requests: readonly AuthorizationRequest<P>[],
  ): Promise<Result<readonly AuthorizationResult[], DomainError>> {
    try {
      // Use existing OPA client batch evaluation
      const opaInputs = requests.map((req) =>
        this.buildOpaInputFromRequest(req),
      );
      const policyPath = this.resolvePolicyPath(requests[0]?.permissions[0]);

      const decisions = await this.opaClient.evaluateBatch(
        policyPath,
        opaInputs,
        {
          correlationId: requests[0]?.context?.correlationId || '',
          tenantId: requests[0]?.actor.tenantId,
          userId: requests[0]?.actor.userId,
        },
      );

      const results: AuthorizationResult[] = decisions.map(
        (decision, index) => ({
          allowed: decision.allow,
          reason: decision.reason,
          obligations: this.mapObligations(
            decision.obligations ? [...decision.obligations] : [],
          ),
          metadata: {
            batchIndex: index,
            policy: policyPath,
            evaluatedAt: new Date().toISOString(),
          },
        }),
      );

      return ok(results);
    } catch (error) {
      return err(
        createServiceUnavailableError(
          error instanceof Error ? error.message : 'Batch authorization failed',
          {
            requestCount: requests.length,
          },
        ),
      );
    }
  }

  /**
   * Get effective permissions for an actor (optional method)
   */
  getEffectivePermissions(
    actor: AuthorizationActor,
    _domain: string,
    _context?: AuthorizationContext,
  ): Promise<Result<readonly P[], DomainError>> {
    // This could be implemented by querying OPA for all permissions
    // or by expanding role-based permissions using shared utilities
    // For now, return permissions from actor directly
    return Promise.resolve(ok((actor.permissions as P[]) || []));
  }

  /**
   * Build OPA input from authorization request using shared utilities
   */
  private buildOpaInputFromRequest(request: AuthorizationRequest<P>): OpaInput {
    return buildOpaInput({
      permissions: request.permissions,
      domain: request.domain,
      actor: request.actor,
      resource: request.resource,
      context: request.context || {
        correlationId: '',
        timestamp: new Date().toISOString(),
      },
      registry: this.permissionRegistry,
    });
  }

  /**
   * Resolve OPA policy path from permission metadata
   */
  private resolvePolicyPath(permission: P): string {
    if (!permission) {
      return 'authz.allow'; // Default policy
    }

    const meta = this.permissionRegistry[permission];
    if (meta?.policyPath) {
      // Extract policy path from metadata (e.g., 'TENANT.product.product_create')
      // Convert to OPA path format (e.g., 'authz/product/allow')
      return this.convertToOpaPath(meta.policyPath);
    }

    // Default policy for unknown permissions
    return 'authz.allow';
  }

  /**
   * Convert policy path metadata to OPA path format
   */
  private convertToOpaPath(policyPath: string): string {
    // Handle different policy path formats
    if (policyPath.startsWith('TENANT.')) {
      // Format: 'TENANT.product.product_create' -> 'authz/product/allow'
      const parts = policyPath.split('.');
      if (parts.length >= 2) {
        return `authz/${parts[1]}/allow`;
      }
    }

    // Handle direct OPA paths
    if (policyPath.includes('/')) {
      return policyPath;
    }

    // Fallback: assume it's a direct policy name
    return `authz/${policyPath}`;
  }

  /**
   * Map OPA obligations to authorization obligations
   */
  private mapObligations(opaObligations: any[]): AuthorizationObligation[] {
    return opaObligations.map((obligation) => {
      // Map common OPA obligation types to our interface
      if (obligation?.type === 'mask' || obligation?.type === 'redact') {
        return {
          type: obligation.type as 'mask' | 'redact',
          fields: obligation.fields || [],
        };
      }

      if (obligation?.type === 'limit') {
        return {
          type: 'limit',
          count: obligation.count,
        };
      }

      if (obligation?.type === 'audit') {
        return {
          type: 'audit',
          level: obligation.level || 'standard',
          required: true,
        };
      }

      // Default mapping for unknown obligation types
      return {
        type: 'custom',
        metadata: obligation,
      };
    });
  }
}

/**
 * Factory function to create OpaAuthorizationService instances
 */
export function createOpaAuthorizationService<P extends string>(
  opaClient: OpaClient,
  decisionLogger: DecisionLoggerService,
  permissionRegistry: PermissionRegistry<P>,
  logger: Logger,
): OpaAuthorizationService<P> {
  return new OpaAuthorizationService(
    opaClient,
    decisionLogger,
    permissionRegistry,
    logger,
  );
}

/**
 * Type guard to check if a service is an OPA authorization service
 */
export function isOpaAuthorizationService<P extends string>(
  service: AuthorizationPort<P>,
): service is OpaAuthorizationService<P> {
  return service instanceof OpaAuthorizationService;
}

/**
 * DI token for OPA Authorization Service
 *
 * Use this token when injecting the OPA authorization service to maintain
 * type safety and avoid magic strings in dependency injection.
 */
export const OPA_AUTHORIZATION_SERVICE_TOKEN =
  'IOpaAuthorizationService' as const;
