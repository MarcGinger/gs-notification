// ⚠️ PRODUCTION-READY: Observable Outcomes + Position Tracking + Event Pipeline
// ✅ Observable outcomes for metrics/SLOs (APPLIED/STALE_OCC/SKIPPED_DEDUP/SKIPPED_HINT)
// ✅ Always advance position, even on skip (prevents infinite reprocessing)
// ✅ Type-safe parameter extraction with generic patterns
// ✅ Auto-routing to softDelete based on predicate

import type { Redis } from 'ioredis';
import type { Logger } from '@nestjs/common';
import {
  CacheOptimizationUtils,
  CacheMetricsCollector,
} from './cache-optimization';
import { RedisPipelineBuilder } from './redis-pipeline-builder';
import { RedisClusterUtils } from './redis-scripts';
import { ProjectorConfig } from './projector-config';

// ✅ Simple ProjectionEvent interface for pipeline processing
export interface ProjectionEvent {
  streamId: string;
  streamRevision: number;
  data: unknown;
  metadata: {
    commitPosition?: number;
    preparePosition?: number;
    [key: string]: unknown;
  };
}

// ✅ Observable outcomes for metrics/SLOs and incident analysis
export enum ProjectionOutcome {
  APPLIED = 1, // Successfully applied to projection
  STALE_OCC = 0, // Optimistic concurrency - stale version (from Lua script)
  SKIPPED_DEDUP = -1, // Already processed (deduplication hit)
  SKIPPED_HINT = -2, // Version hint optimization skip
  UNKNOWN = -99, // Unexpected/error outcome
}

// ✅ Position extraction helper for consistent checkpoint management
export class EventPositionUtils {
  static positionFrom(event: ProjectionEvent): string | undefined {
    const { commitPosition, preparePosition } = event.metadata;
    return commitPosition ? `${commitPosition}:${preparePosition}` : undefined;
  }

  static parsePosition(
    position: string,
  ): { commitPosition: number; preparePosition: number } | null {
    const parts = position.split(':');
    if (parts.length !== 2) return null;

    const commitPosition = parseInt(parts[0], 10);
    const preparePosition = parseInt(parts[1], 10);

    if (isNaN(commitPosition) || isNaN(preparePosition)) return null;

    return { commitPosition, preparePosition };
  }
}

// ✅ Generic event pipeline processor with observability
export class EventPipelineProcessor {
  static async processEvent<TRowParams>(
    event: ProjectionEvent,
    options: {
      cacheAdapter?: CacheOptimizationUtils;
      metricsCollector?: CacheMetricsCollector;
      redis: Redis;
      logger: Logger;
      tenant: string;
      entityType: string;
      extractParams: (event: ProjectionEvent) => TRowParams;
      buildFieldPairs: (params: TRowParams) => Array<[string, string]>; // ✅ Ordered tuples
      generateKeys: (params: TRowParams) => {
        entityKey: string;
        indexKey: string;
      };
      getEntityId: (params: TRowParams) => string;
      getVersion: (params: TRowParams) => number;
      getUpdatedAt: (params: TRowParams) => Date;
      isDelete?: (params: TRowParams) => boolean; // ✅ Auto-route to softDelete
      updateHealthStatus: (position?: string) => void;
      updateHealthError: (error: string) => void;
    },
  ): Promise<ProjectionOutcome> {
    const {
      redis,
      logger,
      tenant,
      entityType,
      extractParams,
      buildFieldPairs,
      generateKeys,
      getEntityId,
      getVersion,
      getUpdatedAt,
      isDelete,
      updateHealthStatus,
      updateHealthError,
      cacheAdapter,
      metricsCollector,
    } = options;

    try {
      // Extract parameters from event
      const params = extractParams(event);
      const entityId = getEntityId(params);
      const version = getVersion(params);
      const updatedAt = getUpdatedAt(params);

      // Generate cluster-safe keys
      const { entityKey, indexKey } = generateKeys(params);

      // ✅ Validate hash-tag consistency for cluster safety
      RedisClusterUtils.validateHashTagConsistency(entityKey, indexKey);

      // ✅ Check deduplication first (most efficient skip)
      if (cacheAdapter) {
        const isDuplicate = await CacheOptimizationUtils.markSeenOnce(
          redis,
          tenant,
          event.streamId,
          event.streamRevision,
          ProjectorConfig.DEDUP_TTL_HOURS,
        );

        if (isDuplicate) {
          metricsCollector?.recordDedupHit();
          logger.debug(
            `Skipped duplicate event: ${event.streamId}@${event.streamRevision}`,
          );
          return ProjectionOutcome.SKIPPED_DEDUP;
        }
        metricsCollector?.recordDedupMiss();
      }

      // ✅ Check version hint optimization (avoid expensive Redis operations)
      if (cacheAdapter) {
        const isStale = await CacheOptimizationUtils.checkVersionHint(
          redis,
          tenant,
          entityType,
          entityId,
          version,
        );

        if (isStale) {
          metricsCollector?.recordVersionHintHit();
          logger.debug(
            `Skipped stale event via version hint: ${entityId}@${version}`,
          );
          return ProjectionOutcome.SKIPPED_HINT;
        }
        metricsCollector?.recordVersionHintMiss();
      }

      // ✅ Execute projection with Redis pipeline
      const pipeline = redis.pipeline();

      if (isDelete?.(params)) {
        // ✅ Auto-route to soft delete
        RedisPipelineBuilder.executeSoftDelete(
          pipeline,
          entityKey,
          indexKey,
          entityId,
          updatedAt,
        );
      } else {
        // ✅ Standard upsert with ordered field pairs
        const fields = buildFieldPairs(params);
        RedisPipelineBuilder.executeUpsert(
          pipeline,
          entityKey,
          indexKey,
          entityId,
          version,
          updatedAt,
          fields,
        );
      }

      // Execute pipeline and handle outcomes
      const results = await pipeline.exec();
      if (!results || results.length === 0) {
        return ProjectionOutcome.UNKNOWN;
      }

      const [error, result] = results[0];
      if (error) {
        throw error;
      }

      const outcome = Number(result);
      const projectionOutcome =
        outcome === 1
          ? ProjectionOutcome.APPLIED
          : outcome === 0
            ? ProjectionOutcome.STALE_OCC
            : ProjectionOutcome.UNKNOWN;

      // ✅ Update version hint on successful application
      if (projectionOutcome === ProjectionOutcome.APPLIED && cacheAdapter) {
        await CacheOptimizationUtils.updateVersionHint(
          redis,
          tenant,
          entityType,
          entityId,
          version,
        );
      }

      return projectionOutcome;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateHealthError(errorMessage);
      logger.error(`Event processing failed: ${errorMessage}`, error);
      return ProjectionOutcome.UNKNOWN;
    } finally {
      // ✅ ALWAYS advance position, even on skip/error (prevents infinite reprocessing)
      const position = EventPositionUtils.positionFrom(event);
      updateHealthStatus(position);
    }
  }

  // ✅ Batch processing with outcome tracking
  static async processBatch<TRowParams>(
    events: ProjectionEvent[],
    options: Parameters<
      typeof EventPipelineProcessor.processEvent<TRowParams>
    >[1],
  ): Promise<{
    outcomes: Map<ProjectionOutcome, number>;
    processed: number;
    errors: Error[];
  }> {
    const outcomes = new Map<ProjectionOutcome, number>();
    const errors: Error[] = [];
    let processed = 0;

    for (const event of events) {
      try {
        const outcome = await this.processEvent(event, options);
        outcomes.set(outcome, (outcomes.get(outcome) || 0) + 1);
        processed++;
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return { outcomes, processed, errors };
  }

  // ✅ Health check utilities
  static getOutcomeMetrics(outcomes: Map<ProjectionOutcome, number>): {
    successRate: number;
    staleConcurrencyRate: number;
    dedupRate: number;
    versionHintRate: number;
    errorRate: number;
    total: number;
  } {
    const total = Array.from(outcomes.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    if (total === 0) {
      return {
        successRate: 0,
        staleConcurrencyRate: 0,
        dedupRate: 0,
        versionHintRate: 0,
        errorRate: 0,
        total: 0,
      };
    }

    return {
      successRate: (outcomes.get(ProjectionOutcome.APPLIED) || 0) / total,
      staleConcurrencyRate:
        (outcomes.get(ProjectionOutcome.STALE_OCC) || 0) / total,
      dedupRate: (outcomes.get(ProjectionOutcome.SKIPPED_DEDUP) || 0) / total,
      versionHintRate:
        (outcomes.get(ProjectionOutcome.SKIPPED_HINT) || 0) / total,
      errorRate: (outcomes.get(ProjectionOutcome.UNKNOWN) || 0) / total,
      total,
    };
  }
}
