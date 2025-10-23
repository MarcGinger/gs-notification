/**
 * Enhanced Cache Service Interface - Extends base CacheService with projector-specific methods
 *
 * This enhanced interface can be shared across all projectors while maintaining
 * backward compatibility with the existing CacheService interface
 */

import { CacheService, CacheStats } from './cache.service';

/**
 * Enhanced cache service interface with projector-specific optimizations
 * Extends the base CacheService interface with specialized methods for:
 * - Event deduplication
 * - Version hints for optimistic concurrency
 * - Metadata caching
 * - Advanced statistics
 */
export interface EnhancedCacheService extends CacheService {
  /**
   * Check if operation was already processed (deduplication)
   */
  isOperationProcessed(operationId: string): Promise<boolean>;

  /**
   * Mark operation as processed with TTL
   */
  markOperationProcessed(
    operationId: string,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Get cached version hint for entity (optimistic concurrency)
   */
  getVersionHint(entityKey: string): Promise<number | null>;

  /**
   * Set version hint for entity
   */
  setVersionHint(
    entityKey: string,
    version: number,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Get cached metadata with type safety
   */
  getMetadata<T>(key: string): Promise<T | null>;

  /**
   * Set cached metadata with type safety
   */
  setMetadata<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Clear cache entries matching pattern (wildcards supported)
   */
  clearPattern(pattern: string): Promise<void>;

  /**
   * Get enhanced cache statistics
   */
  getEnhancedStats(): Promise<EnhancedCacheStats>;
}

/**
 * Enhanced cache statistics
 */
export interface EnhancedCacheStats extends CacheStats {
  missRate: number;
  operationCacheSize: number;
  versionCacheSize: number;
  metadataCacheSize: number;
  memoryUsage?: number;
}

/**
 * Cache strategy factory for creating different cache implementations
 */
export interface CacheStrategyFactory {
  createInMemory(defaultTtlSeconds?: number): EnhancedCacheService;
  createRedis(
    redisClient: any,
    keyPrefix?: string,
    defaultTtlSeconds?: number,
  ): EnhancedCacheService;
  createHybrid(
    redisClient: any,
    keyPrefix?: string,
    l1TtlSeconds?: number,
    l2TtlSeconds?: number,
  ): EnhancedCacheService;
}
