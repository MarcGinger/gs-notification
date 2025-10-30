// ⚠️ PRODUCTION-READY: SET NX EX + Centralized Key Schema + Race-Free Cache
// ✅ SET NX EX: Atomic cache operations, no exists+set race condition
// ✅ Centralized key schema: Single source of truth for prefixes
// ✅ Version hint optimization with configurable TTL
// ✅ Hash-tag aware key generation for cluster safety

import type { Redis } from 'ioredis';
import { ProjectorConfig } from './projector-config';

export class CacheOptimizationUtils {
  // ✅ Centralized key schema - single source of truth
  static getVersionHintKey(
    tenant: string,
    entityType: string,
    entityId: string,
    versionKeyPrefix?: string,
  ): string {
    const prefix = versionKeyPrefix ?? ProjectorConfig.VERSION_KEY_PREFIX;
    return `${prefix}{${tenant}}:${entityType}:${entityId}`;
  }

  static getDedupKey(
    tenant: string,
    streamId: string,
    revision: number,
    dedupKeyPrefix?: string,
  ): string {
    const prefix = dedupKeyPrefix ?? ProjectorConfig.DEDUPE_KEY_PREFIX;
    return `${prefix}{${tenant}}:${streamId}:${revision}`;
  }

  // ✅ SET NX EX - atomic operation, eliminates race condition
  // Previously: exists + set (race condition between operations)
  // Now: Single atomic SET NX EX command
  static async markSeenOnce(
    redis: Redis,
    tenant: string,
    streamId: string,
    revision: number,
    ttlHours: number = ProjectorConfig.DEDUP_TTL_HOURS,
    dedupKeyPrefix?: string,
  ): Promise<boolean> {
    const key = this.getDedupKey(tenant, streamId, revision, dedupKeyPrefix);
    const ttlSeconds = ttlHours * 3600;

    // ✅ Single atomic operation - no race condition
    // SET key value EX seconds NX
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK'; // true = first time seen, false = duplicate
  }

  // ✅ Version hint optimization with cluster-safe keys
  static async checkVersionHint(
    redis: Redis,
    tenant: string,
    entityType: string,
    entityId: string,
    incomingVersion: number,
    versionKeyPrefix?: string,
  ): Promise<boolean> {
    const key = this.getVersionHintKey(
      tenant,
      entityType,
      entityId,
      versionKeyPrefix,
    );
    const projectedVersion = await redis.get(key);

    if (!projectedVersion) {
      return false; // No hint available
    }

    const projectedVersionNum = parseInt(projectedVersion, 10);
    return (
      !isNaN(projectedVersionNum) && projectedVersionNum >= incomingVersion
    );
  }

  // ✅ Update version hint with optional TTL
  static async updateVersionHint(
    redis: Redis,
    tenant: string,
    entityType: string,
    entityId: string,
    version: number,
    ttlSeconds?: number | null,
    versionKeyPrefix?: string,
  ): Promise<void> {
    const key = this.getVersionHintKey(
      tenant,
      entityType,
      entityId,
      versionKeyPrefix,
    );
    const actualTtl = ttlSeconds ?? ProjectorConfig.VERSION_HINT_TTL_SECONDS;

    if (actualTtl && actualTtl > 0) {
      await redis.setex(key, actualTtl, version.toString());
    } else {
      await redis.set(key, version.toString());
    }
  }

  // ✅ Batch version hint updates for performance
  static async updateVersionHintsBatch(
    redis: Redis,
    updates: Array<{
      tenant: string;
      entityType: string;
      entityId: string;
      version: number;
    }>,
    ttlSeconds?: number | null,
  ): Promise<void> {
    if (updates.length === 0) return;

    const pipeline = redis.pipeline();
    const actualTtl = ttlSeconds ?? ProjectorConfig.VERSION_HINT_TTL_SECONDS;

    for (const update of updates) {
      const key = this.getVersionHintKey(
        update.tenant,
        update.entityType,
        update.entityId,
      );

      if (actualTtl && actualTtl > 0) {
        pipeline.setex(key, actualTtl, update.version.toString());
      } else {
        pipeline.set(key, update.version.toString());
      }
    }

    await pipeline.exec();
  }

  // ✅ Cleanup expired dedup keys (housekeeping)
  static async cleanupExpiredDedupKeys(
    redis: Redis,
    tenant: string,
    batchSize: number = 100,
  ): Promise<number> {
    const pattern = `${ProjectorConfig.DEDUPE_KEY_PREFIX}{${tenant}}:*`;
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        batchSize,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Check TTL for each key and delete expired ones
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.ttl(key);
        }
        const ttlResults = await pipeline.exec();

        const expiredKeys = keys.filter((_, index) => {
          const ttlResult = ttlResults?.[index];
          return ttlResult && ttlResult[1] === -1; // Key exists but no TTL
        });

        if (expiredKeys.length > 0) {
          await redis.del(...expiredKeys);
          deletedCount += expiredKeys.length;
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  }

  // ✅ Health check for cache connectivity
  static async healthCheck(redis: Redis): Promise<{
    connected: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await redis.ping();
      return {
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ✅ Metrics and observability helpers
export interface CacheMetrics {
  dedupHits: number;
  dedupMisses: number;
  versionHintHits: number;
  versionHintMisses: number;
  totalOperations: number;
}

export class CacheMetricsCollector {
  private metrics: CacheMetrics = {
    dedupHits: 0,
    dedupMisses: 0,
    versionHintHits: 0,
    versionHintMisses: 0,
    totalOperations: 0,
  };

  recordDedupHit(): void {
    this.metrics.dedupHits++;
    this.metrics.totalOperations++;
  }

  recordDedupMiss(): void {
    this.metrics.dedupMisses++;
    this.metrics.totalOperations++;
  }

  recordVersionHintHit(): void {
    this.metrics.versionHintHits++;
    this.metrics.totalOperations++;
  }

  recordVersionHintMiss(): void {
    this.metrics.versionHintMisses++;
    this.metrics.totalOperations++;
  }

  getMetrics(): Readonly<CacheMetrics> {
    return { ...this.metrics };
  }

  getDedupHitRate(): number {
    const total = this.metrics.dedupHits + this.metrics.dedupMisses;
    return total > 0 ? this.metrics.dedupHits / total : 0;
  }

  getVersionHintHitRate(): number {
    const total = this.metrics.versionHintHits + this.metrics.versionHintMisses;
    return total > 0 ? this.metrics.versionHintHits / total : 0;
  }

  reset(): void {
    this.metrics = {
      dedupHits: 0,
      dedupMisses: 0,
      versionHintHits: 0,
      versionHintMisses: 0,
      totalOperations: 0,
    };
  }
}
