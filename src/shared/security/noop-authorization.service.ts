/**
 * Noop Authorization Service
 *
 * Null object pattern implementation of AuthorizationPort for:
 * - Feature flag rollout (authorization can be disabled/bypassed)
 * - Testing scenarios where authorization should not block operations
 * - Development environments where permission checking is not needed
 *
 * This service always allows all operations but maintains the same interface
 * contract as the production OPA service.
 */

import { Injectable, Inject } from '@nestjs/common';
// Logging infrastructure
import { APP_LOGGER, componentLogger, Logger } from '../logging';

// Authorization abstractions
import type {
  AuthorizationPort,
  AuthorizationRequest,
  AuthorizationResult,
  AuthorizationActor,
  AuthorizationContext,
} from './authorization.port';

// Shared types
import { Result, DomainError, ok } from '../errors/error.types';

/**
 * Token for injecting NoopAuthorizationService implementation
 */
export const NOOP_AUTHORIZATION_SERVICE_TOKEN =
  'INoopAuthorizationService' as const;

const COMPONENT = 'NoopAuthorizationService';

/**
 * No-operation authorization service
 *
 * Implements the AuthorizationPort interface but always allows all operations.
 * Useful for:
 * - Feature flag rollout where authorization is gradually enabled
 * - Testing environments where permission checks should not block operations
 * - Development setups where full OPA infrastructure is not available
 */
@Injectable()
export class NoopAuthorizationService<P extends string>
  implements AuthorizationPort<P>
{
  private readonly logger: Logger;

  constructor(@Inject(APP_LOGGER) moduleLogger: Logger) {
    this.logger = componentLogger(moduleLogger, COMPONENT);
  }

  /**
   * Check authorization - always allows with informational logging
   */
  async check(
    request: AuthorizationRequest<P>,
  ): Promise<Result<AuthorizationResult, DomainError>> {
    const startTime = Date.now();

    // Log the authorization attempt for audit/debugging
    this.logger.debug('Authorization bypassed (noop service)', {
      correlationId: request.context?.correlationId,
      domain: request.domain,
      permissions: request.permissions,
      actor: request.actor.userId,
      resource: request.resource?.id,
    } as any);

    const duration = Date.now() - startTime;

    // Always return success with metadata indicating this was bypassed
    const result: AuthorizationResult = {
      allowed: true,
      reason: 'Authorization bypassed - using noop service',
      obligations: [], // No obligations for noop service
      metadata: {
        duration,
        service: 'noop',
        evaluatedAt: new Date().toISOString(),
        bypassed: true,
      },
    };

    return ok(result);
  }

  /**
   * Batch authorization checking - always allows all requests
   */
  async checkBatch(
    requests: readonly AuthorizationRequest<P>[],
  ): Promise<Result<readonly AuthorizationResult[], DomainError>> {
    const startTime = Date.now();

    this.logger.debug('Batch authorization bypassed (noop service)', {
      requestCount: requests.length,
      domains: [...new Set(requests.map((r) => r.domain))],
    } as any);

    const duration = Date.now() - startTime;

    // Return success for all requests
    const results: AuthorizationResult[] = requests.map((request, index) => ({
      allowed: true,
      reason: 'Authorization bypassed - using noop service',
      obligations: [],
      metadata: {
        batchIndex: index,
        service: 'noop',
        duration: Math.floor(duration / requests.length), // Distribute duration
        evaluatedAt: new Date().toISOString(),
        bypassed: true,
      },
    }));

    return ok(results);
  }

  /**
   * Get effective permissions - returns all permissions from actor
   */
  getEffectivePermissions(
    actor: AuthorizationActor,
    _domain: string,
    context?: AuthorizationContext,
  ): Promise<Result<readonly P[], DomainError>> {
    this.logger.debug('Effective permissions bypassed (noop service)', {
      correlationId: context?.correlationId,
      actor: actor.userId,
      providedPermissions: actor.permissions?.length || 0,
    } as any);

    // Return all permissions from the actor (no filtering)
    return Promise.resolve(ok((actor.permissions as P[]) || []));
  }
}

/**
 * Factory function to create NoopAuthorizationService instances
 */
export function createNoopAuthorizationService<P extends string>(
  logger: Logger,
): NoopAuthorizationService<P> {
  return new NoopAuthorizationService(logger);
}

/**
 * Type guard to check if a service is a noop authorization service
 */
export function isNoopAuthorizationService<P extends string>(
  service: AuthorizationPort<P>,
): service is NoopAuthorizationService<P> {
  return service instanceof NoopAuthorizationService;
}

/**
 * Configuration helper for conditional authorization service creation
 */
export interface AuthorizationServiceConfig {
  enabled: boolean;
  development?: boolean;
  bypassForTesting?: boolean;
}

/**
 * Helper to determine if noop service should be used based on configuration
 */
export function shouldUseNoopAuthorization(
  config: AuthorizationServiceConfig,
): boolean {
  return (
    !config.enabled ||
    config.development === true ||
    config.bypassForTesting === true
  );
}
