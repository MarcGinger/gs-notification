// Unified Redis Projector Mixin - Simple Approach
// Provides shared functionality without forcing inheritance changes

import Redis from 'ioredis';
import { ProjectionEvent } from 'src/shared/infrastructure/projections/catchup.runner';
import { registerRedisScripts } from 'src/shared/infrastructure/projections/redis-scripts';
import {
  CacheOptimizationUtils,
  CacheMetricsCollector,
} from 'src/shared/infrastructure/projections/cache-optimization';
import { RedisPipelineBuilder } from 'src/shared/infrastructure/projections/redis-pipeline-builder';
import { RedisClusterUtils } from 'src/shared/infrastructure/projections/redis-scripts';
import { ProjectionOutcome } from 'src/shared/infrastructure/projections/event-pipeline-processor';
import { TenantExtractor } from 'src/shared/infrastructure/projections/projection.utils';
import { EventEncryptionFactory } from 'src/shared/infrastructure/encryption';
import { Logger, Log } from 'src/shared/logging';

/**
 * Configuration for unified projection operations
 */
export interface UnifiedProjectionConfig {
  projectorName: string;
  versionKeyPrefix: string;
  getRedisEntityKey: (tenant: string, id: string) => string;
  getRedisIndexKey: (tenant: string) => string;
}

/**
 * Parameters required for unified projection operations
 */
export interface UnifiedProjectionParams {
  id: string;
  version: number;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Unified Redis Projector Utilities
 *
 * Provides shared functionality that can be mixed into existing projectors
 * without requiring major refactoring. This is a more practical approach
 * that doesn't force inheritance changes.
 *
 * Usage in existing projectors:
 * ```typescript
 * class MyProjector extends BaseProjector {
 *   private projectorUtils = new UnifiedProjectorUtils(this.config, this.redis, this.logger);
 *
 *   async projectEvent(event: ProjectionEvent) {
 *     const params = this.extractMyParams(event);
 *     return this.projectorUtils.executeProjection(event, params, this.eventEncryptionFactory);
 *   }
 * }
 * ```
 */
export class UnifiedProjectorUtils {
  private readonly metricsCollector = new CacheMetricsCollector();
  private cacheOptimization = new CacheOptimizationUtils();
  private pipelineBuilder = new RedisPipelineBuilder();

  constructor(
    private readonly config: UnifiedProjectionConfig,
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {
    // Register Redis scripts on construction
    registerRedisScripts(this.redis);
  }

  /**
   * Execute unified projection logic
   *
   * This method encapsulates all the common projection logic:
   * - Version hint checking
   * - Redis pipeline operations
   * - Cache updates
   * - Outcome logging
   */
  async executeProjection(
    event: ProjectionEvent,
    params: UnifiedProjectionParams,
    eventEncryptionFactory?: EventEncryptionFactory,
  ): Promise<ProjectionOutcome> {
    const tenant = TenantExtractor.extractTenant(event);

    try {
      // Apply version hint deduplication
      const alreadyProcessed = await CacheOptimizationUtils.checkVersionHint(
        this.redis,
        tenant,
        this.config.projectorName.toLowerCase(),
        params.id,
        params.version,
        this.config.versionKeyPrefix,
      );

      if (alreadyProcessed) {
        this.logger.debug(
          `${this.config.projectorName} already processed - using version hint optimization for ${params.id} version ${params.version}`,
        );
        return ProjectionOutcome.SKIPPED_HINT;
      }

      // Build field pairs using shared utility
      const fieldPairs = RedisPipelineBuilder.buildFieldPairs(
        params as unknown as Record<string, unknown>,
      );

      // Generate cluster-safe keys
      const entityKey = this.config.getRedisEntityKey(tenant, params.id);
      const indexKey = this.config.getRedisIndexKey(tenant);

      // Validate hash-tag consistency for cluster safety
      RedisClusterUtils.validateHashTagConsistency(entityKey, indexKey);

      // Create pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Route to soft delete or upsert based on deletion state
      if (params.deletedAt) {
        RedisPipelineBuilder.executeSoftDelete(
          pipeline,
          entityKey,
          indexKey,
          params.id,
          params.deletedAt,
        );
      } else {
        RedisPipelineBuilder.executeUpsert(
          pipeline,
          entityKey,
          indexKey,
          params.id,
          params.version,
          params.updatedAt,
          fieldPairs,
        );
      }

      // Execute pipeline and handle results
      const results = await pipeline.exec();
      const operationSucceeded = results && results.every(([error]) => !error);
      const outcome = operationSucceeded
        ? ProjectionOutcome.APPLIED
        : ProjectionOutcome.STALE_OCC;

      // Update cache hint to prevent reprocessing
      await CacheOptimizationUtils.updateVersionHint(
        this.redis,
        tenant,
        this.config.projectorName.toLowerCase(),
        params.id,
        params.version,
        undefined, // Use default TTL
        this.config.versionKeyPrefix,
      );

      // Log outcome with optional encryption context
      this.logProjectionOutcome(
        outcome,
        event,
        tenant,
        params,
        eventEncryptionFactory,
      );

      return outcome;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to project event with unified pipeline', {
        method: 'executeProjection',
        projectorName: this.config.projectorName,
        eventType: event.type,
        streamId: event.streamId,
        revision: event.revision,
        tenant,
        error: e.message,
        stack: e.stack,
      });
      throw error;
    }
  }

  /**
   * Get encryption-related log data if encryption factory is available
   */
  getEncryptionLogData(
    params: Record<string, unknown>,
    eventEncryptionFactory?: EventEncryptionFactory,
  ): Record<string, unknown> {
    if (!eventEncryptionFactory) {
      return { hasEncryption: false };
    }

    const availableStrategies = eventEncryptionFactory.getAvailableStrategies();

    // Find potential SecretRef fields (fields ending with 'Secret' or common secret field names)
    const secretFields = [
      'signingSecret',
      'username',
      'password',
      'token',
      'key',
    ];
    const secretRefTypes: Record<string, string> = {};
    let hasSealedSecrets = false;

    for (const fieldName of secretFields) {
      if (params[fieldName] && typeof params[fieldName] === 'string') {
        const secretRefJson = params[fieldName] as string;
        const inspection = EventEncryptionFactory.inspectSecretRefType(
          secretRefJson,
          availableStrategies,
        );
        secretRefTypes[`${fieldName}Type`] = inspection.type;
        if (inspection.type === 'sealed') {
          hasSealedSecrets = true;
        }
      }
    }

    return {
      hasEncryption: true,
      availableEncryptionStrategies: availableStrategies,
      hasSealedSecrets,
      ...secretRefTypes,
    };
  }

  /**
   * Log projection outcomes with unified format
   */
  private logProjectionOutcome(
    outcome: ProjectionOutcome,
    event: ProjectionEvent,
    tenant: string,
    params: UnifiedProjectionParams,
    eventEncryptionFactory?: EventEncryptionFactory,
  ): void {
    const outcomeLabels = {
      [ProjectionOutcome.APPLIED]: 'applied',
      [ProjectionOutcome.STALE_OCC]: 'stale_occ',
      [ProjectionOutcome.SKIPPED_DEDUP]: 'skipped_dedup',
      [ProjectionOutcome.SKIPPED_HINT]: 'skipped_hint',
      [ProjectionOutcome.UNKNOWN]: 'unknown',
    };

    const outcomeLabel = outcomeLabels[outcome] || 'unknown';
    const level = outcome === ProjectionOutcome.APPLIED ? 'debug' : 'info';

    const logData = {
      method: 'executeProjection',
      projectorName: this.config.projectorName,
      outcome,
      outcomeLabel,
      eventType: event.type,
      streamId: event.streamId,
      revision: event.revision,
      tenant,
      metrics: this.metricsCollector.getMetrics(),
      ...this.getEncryptionLogData(
        params as unknown as Record<string, unknown>,
        eventEncryptionFactory,
      ),
    };

    Log[level](
      this.logger,
      `Event projection outcome: ${outcomeLabel}`,
      logData,
    );
  }
}
