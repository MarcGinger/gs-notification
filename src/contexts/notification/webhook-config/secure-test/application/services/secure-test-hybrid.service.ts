/**
 * Hybrid Service Implementation for SecretRef Migration
 *
 * This service provides a bridge between legacy and SecretRef implementations,
 * allowing for gradual rollout while maintaining backward compatibility.
 */

import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { APP_LOGGER, Log, Logger } from 'src/shared/logging';
import type { Result, DomainError } from 'src/shared/errors';
import type { ActorContext } from 'src/shared/application/context/actor-context';

import { CreateSecureTestProps } from '../../domain/props';
import { DetailSecureTestResponse } from '../dtos';
import {
  SecureTestSecretMappingService,
  SecretMappingContext,
} from './secure-test-secret-mapping.service';
import {
  getSecretRefMigrationConfig,
  SecretRefMigrationConfig,
} from '../config/secretref-migration.config';

/**
 * Migration metrics for monitoring rollout progress
 */
interface MigrationMetrics {
  secretRefAttempts: number;
  secretRefSuccesses: number;
  secretRefFailures: number;
  legacyFallbacks: number;
  totalRequests: number;
}

/**
 * SecureTestHybridService
 *
 * Core service that orchestrates the gradual migration from legacy
 * SecureTest implementation to SecretRef-protected implementation.
 *
 * This service implements:
 * - Feature flag-based routing
 * - Gradual tenant rollout
 * - Fallback mechanisms
 * - Migration monitoring
 * - Error handling and recovery
 */
@Injectable()
export class SecureTestHybridService {
  private readonly logger = new NestLogger(SecureTestHybridService.name);
  private readonly metrics: MigrationMetrics = {
    secretRefAttempts: 0,
    secretRefSuccesses: 0,
    secretRefFailures: 0,
    legacyFallbacks: 0,
    totalRequests: 0,
  };

  constructor(
    private readonly secretMappingService: SecureTestSecretMappingService,
    // Note: Legacy service would be injected here in real implementation
    // private readonly legacyService: SecureTestLegacyService,
  ) {}

  /**
   * Create SecureTest with intelligent routing
   *
   * This method implements the core migration logic:
   * 1. Determine routing strategy based on tenant and configuration
   * 2. Attempt SecretRef implementation if enabled
   * 3. Fallback to legacy implementation on failure (if configured)
   * 4. Track metrics for monitoring and rollback decisions
   */
  async create(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    this.metrics.totalRequests++;

    const config = getSecretRefMigrationConfig();
    const shouldUseSecretRef = this.shouldUseSecretRefForTenant(
      context.tenant,
      config,
    );

    this.logger.debug('SecureTest creation routing decision', {
      tenantId: context.tenant,
      userId: context.userId,
      shouldUseSecretRef,
      configEnabled: config.enabled,
      rolloutPercentage: config.rolloutPercentage,
    });

    if (shouldUseSecretRef) {
      return await this.attemptSecretRefCreation(request, context, config);
    }

    // Route to legacy implementation
    return await this.createWithLegacy(request, context);
  }

  /**
   * Attempt SecretRef creation with fallback handling
   */
  private async attemptSecretRefCreation(
    request: CreateSecureTestProps,
    context: ActorContext,
    config: SecretRefMigrationConfig,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    this.metrics.secretRefAttempts++;

    try {
      const result = await this.createWithSecretRef(request, context);

      if (result.ok) {
        this.metrics.secretRefSuccesses++;
        this.logger.debug('SecretRef creation succeeded', {
          tenantId: context.tenant,
          userId: context.userId,
          entityId: request.id,
        });
        return result;
      }

      // SecretRef creation failed
      this.metrics.secretRefFailures++;
      this.logger.warn('SecretRef creation failed', {
        tenantId: context.tenant,
        userId: context.userId,
        error: result.error,
        willFallback: config.fallbackToLegacy,
      });

      // Decide whether to fallback or propagate error
      if (config.fallbackToLegacy) {
        this.metrics.legacyFallbacks++;
        this.logger.log('Falling back to legacy implementation', {
          tenantId: context.tenant,
          userId: context.userId,
        });
        return await this.createWithLegacy(request, context);
      }

      // No fallback - propagate SecretRef error
      return result;
    } catch (error) {
      this.metrics.secretRefFailures++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('SecretRef creation threw exception', {
        tenantId: context.tenant,
        userId: context.userId,
        error: errorMessage,
        stack: errorStack,
        willFallback: config.fallbackToLegacy,
      });

      if (config.fallbackToLegacy) {
        this.metrics.legacyFallbacks++;
        return await this.createWithLegacy(request, context);
      }

      throw error;
    }
  }

  /**
   * Create SecureTest using SecretRef implementation
   */
  private async createWithSecretRef(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    // Step 1: Map API props to SecretRef-protected domain props
    const mappingContext: SecretMappingContext = {
      tenantId: context.tenant,
      namespace: 'notification.webhook-config.secure-test',
      requestId: context.userId, // Use userId as requestId for now
      userId: context.userId,
    };

    const securePropsResult =
      await this.secretMappingService.mapCreatePropsToSecureProps(
        request,
        mappingContext,
      );

    if (!securePropsResult.ok) {
      return securePropsResult as Result<DetailSecureTestResponse, DomainError>;
    }

    // Step 2: Create domain aggregate with SecretRef props
    // Note: This would integrate with your existing domain layer
    // const aggregateResult = await this.createDomainAggregate(securePropsResult.value, context);

    // Step 3: Map response back to DTO format
    const responseMetadata =
      this.secretMappingService.mapSecurePropsToResponseMetadata(
        securePropsResult.value,
      );

    // For now, return a placeholder response
    // In real implementation, this would come from the aggregate creation
    const response: DetailSecureTestResponse = {
      id: responseMetadata.id,
      name: responseMetadata.name,
      description: responseMetadata.description,
      type: responseMetadata.type,
      signatureAlgorithm: responseMetadata.signatureAlgorithm,
      // Security: Don't expose actual secrets in API response
      signingSecret: undefined, // responseMetadata.hasSigningSecret ? '[PROTECTED]' : undefined,
      username: undefined, // responseMetadata.hasUsername ? '[PROTECTED]' : undefined,
      password: undefined, // responseMetadata.hasPassword ? '[PROTECTED]' : undefined,
    };

    return { ok: true, value: response };
  }

  /**
   * Create SecureTest using legacy implementation
   */
  private createWithLegacy(
    request: CreateSecureTestProps,
    _context: ActorContext,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    // Note: This would delegate to the existing legacy service
    // return await this.legacyService.create(request, context);

    // Placeholder implementation
    const response: DetailSecureTestResponse = {
      id: request.id,
      name: request.name,
      description: request.description,
      type: request.type,
      signatureAlgorithm: request.signatureAlgorithm,
      signingSecret: request.signingSecret,
      username: request.username,
      password: request.password,
    };

    return Promise.resolve({ ok: true, value: response });
  }

  /**
   * Determine if SecretRef should be used for a tenant
   *
   * Implements the routing logic based on configuration:
   * - Feature flag checks
   * - Tenant whitelist
   * - Percentage-based rollout
   * - Environment-specific overrides
   */
  private shouldUseSecretRefForTenant(
    tenantId: string,
    config: SecretRefMigrationConfig,
  ): boolean {
    // Master feature flag check
    if (!config.enabled) {
      return false;
    }

    // Explicit tenant whitelist (always use SecretRef)
    if (config.whitelistedTenants.includes(tenantId)) {
      this.logger.debug('Tenant whitelisted for SecretRef', {
        tenant: tenantId,
      });
      return true;
    }

    // Percentage-based gradual rollout
    if (config.rolloutPercentage === 0) {
      return false;
    }

    if (config.rolloutPercentage >= 100) {
      return true;
    }

    // Consistent hash-based rollout
    // Ensures same tenant always gets same decision across restarts
    const hash = this.hashTenantId(tenantId);
    const useSecretRef = hash % 100 < config.rolloutPercentage;

    this.logger.debug('Percentage-based rollout decision', {
      tenant: tenantId,
      hash,
      rolloutPercentage: config.rolloutPercentage,
      useSecretRef,
    });

    return useSecretRef;
  }

  /**
   * Create consistent hash for tenant ID
   *
   * Uses a simple but effective hash function that ensures:
   * - Same tenant always gets same hash
   * - Uniform distribution across tenants
   * - No bias in rollout selection
   */
  private hashTenantId(tenantId: string): number {
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      const char = tenantId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get current migration metrics for monitoring
   */
  getMigrationMetrics(): MigrationMetrics & {
    successRate: number;
    fallbackRate: number;
  } {
    const successRate =
      this.metrics.secretRefAttempts > 0
        ? (this.metrics.secretRefSuccesses / this.metrics.secretRefAttempts) *
          100
        : 0;

    const fallbackRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.legacyFallbacks / this.metrics.totalRequests) * 100
        : 0;

    return {
      ...this.metrics,
      successRate: Number(successRate.toFixed(2)),
      fallbackRate: Number(fallbackRate.toFixed(2)),
    };
  }

  /**
   * Reset migration metrics (useful for testing or monitoring windows)
   */
  resetMetrics(): void {
    this.metrics.secretRefAttempts = 0;
    this.metrics.secretRefSuccesses = 0;
    this.metrics.secretRefFailures = 0;
    this.metrics.legacyFallbacks = 0;
    this.metrics.totalRequests = 0;
  }

  /**
   * Health check for SecretRef functionality
   *
   * Can be used by monitoring systems to verify migration health
   */
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    config: SecretRefMigrationConfig;
    metrics: ReturnType<typeof this.getMigrationMetrics>;
    issues: string[];
  }> {
    const config = getSecretRefMigrationConfig();
    const metrics = this.getMigrationMetrics();
    const issues: string[] = [];

    // Check for high failure rate
    if (metrics.secretRefAttempts > 10 && metrics.successRate < 80) {
      issues.push(`Low SecretRef success rate: ${metrics.successRate}%`);
    }

    // Check for high fallback rate
    if (metrics.totalRequests > 10 && metrics.fallbackRate > 50) {
      issues.push(`High fallback rate: ${metrics.fallbackRate}%`);
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = metrics.successRate < 50 ? 'unhealthy' : 'degraded';
    }

    return Promise.resolve({
      status,
      config,
      metrics,
      issues,
    });
  }
}
