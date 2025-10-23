import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  ProjectionCacheService,
  ProjectionCacheStats,
} from './projection-cache.service';
import { IO_REDIS } from '../infrastructure.tokens';

/**
 * Redis implementation of ProjectionCacheService
 * Suitable for production and distributed deployments
 */
@Injectable()
export class RedisProjectionCache implements ProjectionCacheService {
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;

  constructor(
    @Inject(IO_REDIS) private readonly redis: Redis,
    keyPrefix = 'proj:',
    defaultTtl = 300,
  ) {
    this.keyPrefix = keyPrefix;
    this.defaultTtl = defaultTtl;
  }

  async isOperationProcessed(operationId: string): Promise<boolean> {
    const key = this.getOperationKey(operationId);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async markOperationProcessed(
    operationId: string,
    ttlSeconds = this.defaultTtl,
  ): Promise<void> {
    const key = this.getOperationKey(operationId);
    await this.redis.setex(key, ttlSeconds, '1');
  }

  async getVersionHint(entityKey: string): Promise<number | null> {
    const key = this.getVersionKey(entityKey);
    const result = await this.redis.get(key);
    return result ? parseInt(result, 10) : null;
  }

  async setVersionHint(
    entityKey: string,
    version: number,
    ttlSeconds = this.defaultTtl,
  ): Promise<void> {
    const key = this.getVersionKey(entityKey);
    await this.redis.setex(key, ttlSeconds, version.toString());
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    const cacheKey = this.getMetadataKey(key);
    const result = await this.redis.get(cacheKey);
    return result ? JSON.parse(result) : null;
  }

  async setMetadata<T>(
    key: string,
    value: T,
    ttlSeconds = this.defaultTtl,
  ): Promise<void> {
    const cacheKey = this.getMetadataKey(key);
    await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(value));
  }

  async clearPattern(pattern: string): Promise<void> {
    const searchPattern = `${this.keyPrefix}${pattern}`;
    const keys = await this.redis.keys(searchPattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getStats(): Promise<ProjectionCacheStats> {
    const pipeline = this.redis.pipeline();

    // Get cache info
    pipeline.info('memory');
    pipeline.dbsize();

    // Count different key types
    pipeline.eval(
      `
      local operation_count = 0
      local version_count = 0
      local metadata_count = 0
      
      local keys = redis.call('KEYS', ARGV[1] .. 'op:*')
      operation_count = #keys
      
      keys = redis.call('KEYS', ARGV[1] .. 'ver:*')
      version_count = #keys
      
      keys = redis.call('KEYS', ARGV[1] .. 'meta:*')
      metadata_count = #keys
      
      return {operation_count, version_count, metadata_count}
      `,
      0,
      this.keyPrefix,
    );

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Failed to retrieve cache statistics');
    }

    const [memoryInfo, dbSize, keyCounts] = results;
    const [operationCount, versionCount, metadataCount] =
      keyCounts[1] as number[];

    // Parse memory info (simplified)
    const memoryUsage = this.parseMemoryInfo(memoryInfo[1] as string);

    return {
      hitRate: 0, // Redis doesn't track hit rate by default
      missRate: 0,
      size: dbSize[1] as number,
      operationCacheSize: operationCount,
      versionCacheSize: versionCount,
      metadataCacheSize: metadataCount,
      memoryUsage,
    };
  }

  private getOperationKey(operationId: string): string {
    return `${this.keyPrefix}op:${operationId}`;
  }

  private getVersionKey(entityKey: string): string {
    return `${this.keyPrefix}ver:${entityKey}`;
  }

  private getMetadataKey(key: string): string {
    return `${this.keyPrefix}meta:${key}`;
  }

  private parseMemoryInfo(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
