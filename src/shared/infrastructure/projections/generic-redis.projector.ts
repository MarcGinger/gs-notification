// Generic Redis Projector - Unified Approach
// Reduces code duplication while maintaining flexibility for encryption-aware projectors

import {
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import Redis from 'ioredis';
import { CatchUpRunner, ProjectionEvent, RunOptions } from './catchup.runner';
import { CheckpointStore } from './checkpoint.store';
import { BaseProjector } from './base.projector';
import {
  CommonProjectorErrorDefinitions,
  createProjectorErrorCatalog,
  TenantExtractor,
} from './projection.utils';
import { registerRedisScripts } from './redis-scripts';
import {
  CacheOptimizationUtils,
  CacheMetricsCollector,
} from './cache-optimization';
import { RedisPipelineBuilder } from './redis-pipeline-builder';
import { RedisClusterUtils } from './redis-scripts';
import { ProjectionOutcome } from './event-pipeline-processor';
import { APP_LOGGER, Log, Logger } from '../../logging';
import { Clock, CLOCK } from '../time';
import { withContext } from '../../errors';
import { CacheService } from '../../application/caching/cache.service';
import { EventEncryptionFactory } from '../../infrastructure/encryption';

/**
 * Configuration interface for GenericRedisProjector
 */
export interface ProjectorConfig {
  projectorName: string;
  subscriptionGroup: string;
  eventStoreStreamPrefix: string;
  versionKeyPrefix: string;
  getRedisEntityKey: (tenant: string, id: string) => string;
  getRedisIndexKey: (tenant: string) => string;
}

/**
 * Interface for field extraction and validation
 */
export interface FieldExtractor<TParams> {
  extractParams(event: ProjectionEvent): TParams;
}

/**
 * Generic projection parameters interface
 */
export interface BaseProjectionParams {
  id: string;
  tenant: string;
  version: number;
  updatedAt: Date;
  deletedAt?: Date | null;
  lastStreamRevision?: string | null;
}

/**
 * Generic Redis Projector
 *
 * Provides a unified approach for Redis projections with optional encryption support.
 * Eliminates code duplication while maintaining flexibility for domain-specific needs.
 *
 * Key Features:
 * - Optional EventEncryptionFactory injection for encryption-aware projectors
 * - Generic parameter extraction via FieldExtractor interface
 * - Configurable Redis key generation strategies
 * - Shared projection infrastructure (Redis scripts, caching, etc.)
 * - Observability and metrics collection
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class MyProjector extends GenericRedisProjector<MyProjectionParams> {
 *   constructor(...deps, fieldExtractor: FieldExtractor<MyProjectionParams>) {
 *     super(
 *       MyProjectorConfig,
 *       fieldExtractor,
 *       deps...,
 *       eventEncryptionFactory // optional for encryption-aware projectors
 *     );
 *   }
 * }
 * ```
 */
export abstract class GenericRedisProjector<
    TParams extends BaseProjectionParams,
  >
  extends BaseProjector
  implements OnModuleInit, OnModuleDestroy
{
  private readonly metricsCollector = new CacheMetricsCollector();
  private cacheOptimization!: CacheOptimizationUtils;
  private pipelineBuilder!: RedisPipelineBuilder;

  protected projectorErrors = createProjectorErrorCatalog(
    'GENERIC_PROJECTOR',
    CommonProjectorErrorDefinitions,
  );

  constructor(
    protected readonly config: ProjectorConfig,
    protected readonly fieldExtractor: FieldExtractor<TParams>,
    @Inject(APP_LOGGER) baseLogger: Logger,
    @Inject(CLOCK) protected readonly clock: Clock,
    protected readonly catchUpRunner: CatchUpRunner,
    checkpointStore: CheckpointStore,
    protected readonly redis: Redis,
    protected readonly cache: CacheService,
    @Optional()
    protected readonly eventEncryptionFactory?: EventEncryptionFactory,
  ) {
    super(
      config.projectorName,
      config.subscriptionGroup,
      baseLogger,
      checkpointStore,
    );

    // Initialize shared utilities
    this.cacheOptimization = new CacheOptimizationUtils();
    this.pipelineBuilder = new RedisPipelineBuilder();

    // Update error catalog name after config is initialized
    this.projectorErrors = createProjectorErrorCatalog(
      this.config.projectorName.toUpperCase() + '_PROJECTOR',
      CommonProjectorErrorDefinitions,
    );

    Log.info(
      this.logger,
      `${config.projectorName} initialized with shared utilities`,
      {
        method: 'constructor',
        subscriptionGroup: this.subscriptionGroup,
        redisStatus: this.redis.status,
        sharedUtilities: true,
        clusterSafe: true,
        evalshaCaching: true,
        hasEncryption: !!this.eventEncryptionFactory,
      },
    );
  }

  /**
   * Start the projector using CatchUpRunner
   */
  onModuleInit(): void {
    Log.info(
      this.logger,
      `Starting ${this.config.projectorName} with CatchUpRunner`,
      {
        method: 'onModuleInit',
        subscriptionGroup: this.subscriptionGroup,
      },
    );

    try {
      // Register EVALSHA scripts for optimization
      registerRedisScripts(this.redis);
      Log.info(this.logger, 'EVALSHA scripts registered successfully', {
        method: 'onModuleInit',
        feature: 'evalsha-optimization',
      });

      const runOptions: RunOptions = {
        prefixes: [this.config.eventStoreStreamPrefix],
        batchSize: 100,
        stopOnCaughtUp: false,
        maxRetries: 3,
        retryDelayMs: 1000,
        checkpointBatchSize: 10,
      };

      // Start the projection in the background
      this.catchUpRunner
        .runSafe(
          this.subscriptionGroup,
          this.projectEvent.bind(this) as (
            event: ProjectionEvent,
          ) => Promise<void>,
          runOptions,
        )
        .then((result) => {
          if (!result.ok) {
            this.updateHealthStatusOnError(
              result.error.detail || 'Unknown error',
            );
            Log.error(this.logger, 'Projection failed to start', {
              method: 'onModuleInit',
              error: result.error.detail || 'Unknown error',
            });
          } else {
            Log.info(this.logger, 'Projection completed successfully', {
              method: 'onModuleInit',
              status: 'completed',
            });
          }
        })
        .catch((error) => {
          const e = error as Error;
          this.updateHealthStatusOnError(e.message);
          Log.error(this.logger, 'Projection failed with exception', {
            method: 'onModuleInit',
            error: e.message,
            stack: e.stack,
          });
        });

      this.setRunning(true);
      this.updateHealthStatusOnSuccess();

      Log.info(
        this.logger,
        `${this.config.projectorName} started successfully`,
        {
          method: 'onModuleInit',
          status: 'running',
        },
      );
    } catch (error) {
      const e = error as Error;
      this.updateHealthStatusOnError(e.message);

      Log.error(this.logger, `Failed to start ${this.config.projectorName}`, {
        method: 'onModuleInit',
        error: e.message,
        stack: e.stack,
      });
      throw error;
    }
  }

  /**
   * Stop the projector
   */
  onModuleDestroy(): void {
    Log.info(this.logger, `Stopping ${this.config.projectorName}`, {
      method: 'onModuleDestroy',
      subscriptionGroup: this.subscriptionGroup,
    });

    try {
      this.catchUpRunner.stop(this.subscriptionGroup);
      this.setRunning(false);

      Log.info(
        this.logger,
        `${this.config.projectorName} stopped successfully`,
        {
          method: 'onModuleDestroy',
          status: 'stopped',
        },
      );
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, `Error stopping ${this.config.projectorName}`, {
        method: 'onModuleDestroy',
        error: e.message,
        stack: e.stack,
      });
    }
  }

  /**
   * Project individual event using shared infrastructure
   */
  private async projectEvent(
    event: ProjectionEvent,
  ): Promise<ProjectionOutcome> {
    const tenant = this.extractTenant(event);

    try {
      // Extract domain-specific parameters using injected field extractor
      const params = this.fieldExtractor.extractParams(event);

      // Apply version hint deduplication first
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
        const outcome = ProjectionOutcome.SKIPPED_HINT;
        this.logProjectionOutcome(outcome, event, tenant);
        return outcome;
      }

      // Build field pairs using shared utility
      const fieldPairs = RedisPipelineBuilder.buildFieldPairs(
        params as unknown as Record<string, unknown>,
      );

      // Generate cluster-safe keys using config
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

      // Log observable outcomes for SLO monitoring
      this.logProjectionOutcome(outcome, event, tenant, params);

      return outcome;
    } catch (error) {
      const e = error as Error;
      this.updateHealthStatusOnError(e.message);

      Log.error(this.logger, 'Failed to project event with shared pipeline', {
        method: 'projectEvent',
        eventType: event.type,
        streamId: event.streamId,
        revision: event.revision,
        tenant,
        error: e.message,
        stack: e.stack,
      });

      throw new Error(
        withContext(this.projectorErrors.DATABASE_OPERATION_FAILED, {
          eventType: event.type,
          streamId: event.streamId,
          originalError: e.message,
        }).detail,
        { cause: e },
      );
    }
  }

  /**
   * Get available encryption strategies (if encryption factory is available)
   */
  protected getAvailableEncryptionStrategies(): string[] {
    return this.eventEncryptionFactory?.getAvailableStrategies() || [];
  }

  /**
   * Inspect SecretRef type for projection metrics (if encryption factory is available)
   */
  protected inspectSecretRefType(secretRefJson?: string): {
    type: 'doppler' | 'sealed' | 'none';
    hasTenantScope: boolean;
    availableStrategies?: string[];
  } {
    if (!this.eventEncryptionFactory) {
      return {
        type: 'none',
        hasTenantScope: false,
        availableStrategies: [],
      };
    }

    const availableStrategies = this.getAvailableEncryptionStrategies();
    return EventEncryptionFactory.inspectSecretRefType(
      secretRefJson,
      availableStrategies,
    );
  }

  /**
   * Log projection outcomes for SLO monitoring and incident analysis
   * Can be overridden by subclasses for domain-specific logging
   */
  protected logProjectionOutcome(
    outcome: ProjectionOutcome,
    event: ProjectionEvent,
    tenant: string,
    params?: TParams,
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

    const baseLogData = {
      method: 'logProjectionOutcome',
      outcome,
      outcomeLabel,
      eventType: event.type,
      streamId: event.streamId,
      revision: event.revision,
      tenant,
      metrics: this.metricsCollector.getMetrics(),
      hasEncryption: !!this.eventEncryptionFactory,
    };

    // Add domain-specific data if available
    const logData = params
      ? { ...baseLogData, ...this.getCustomLogData(params) }
      : baseLogData;

    Log[level](
      this.logger,
      `Event projection outcome: ${outcomeLabel}`,
      logData,
    );
  }

  /**
   * Override this method to add domain-specific log data
   */
  protected getCustomLogData(params: TParams): Record<string, unknown> {
    return {};
  }

  /**
   * Extract tenant ID from event using shared utility
   */
  private extractTenant(event: ProjectionEvent): string {
    return TenantExtractor.extractTenant(event);
  }
}
