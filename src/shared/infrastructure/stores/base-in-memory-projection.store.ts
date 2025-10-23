/**
 * Generic In-Memory Projection Store Abstraction
 *
 * Provides reusable patterns for creating in-memory projection stores
 * that wrap projectors and provide clean interfaces for repositories.
 *
 * This abstraction enables:
 * - Consistent store interfaces across domains
 * - Reusable error handling and logging patterns
 * - Standardized health checks and metrics collection
 * - Type-safe projection mapping
 */

import { Logger, Log } from 'src/shared/logging';

/**
 * Generic projection interface with common metadata
 */
export interface BaseProjection {
  // Core identification
  tenantId: string;
  version: number;

  // Lifecycle metadata
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Generic projection store statistics
 */
export interface ProjectionStoreStats {
  totalProjections: number;
  cacheHitRate?: number;
  memoryUsageBytes?: number;
  lastUpdated: Date;
}

/**
 * Generic projection store interface
 */
export interface IProjectionStore<TProjection extends BaseProjection> {
  /**
   * Get projection by key
   */
  getProjection(key: string): Promise<TProjection | undefined>;

  /**
   * Check if projection exists (without loading full data)
   */
  hasProjection(key: string): Promise<boolean>;

  /**
   * Get store statistics
   */
  getStats(): Promise<ProjectionStoreStats>;

  /**
   * Generate projection key for tenant and identifier
   */
  buildProjectionKey(tenantId: string, identifier: string): string;

  /**
   * Health check - verify store is accessible
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Generic projector interface for in-memory operations
 */
export interface IInMemoryProjector<TInternalProjection> {
  /**
   * Get projection by key with hit/miss tracking
   */
  getProjection(key: string): TInternalProjection | undefined;

  /**
   * Get all projections (for testing and inspection)
   */
  getAllProjections(): Array<[string, TInternalProjection]>;

  /**
   * Get current metrics
   */
  getMetrics(): {
    hitCount: number;
    missCount: number;
    memoryUsageBytes?: number;
    totalEvents?: number;
  };
}

/**
 * Configuration options for projection store
 */
export interface ProjectionStoreConfig {
  keyPrefix?: string;
  enableMetrics?: boolean;
  healthCheckInterval?: number;
}

/**
 * Abstract base class for in-memory projection stores
 */
export abstract class BaseInMemoryProjectionStore<
  TProjection extends BaseProjection,
  TInternalProjection,
  TProjector extends IInMemoryProjector<TInternalProjection>,
> implements IProjectionStore<TProjection>
{
  protected readonly logger: Logger;
  protected readonly config: ProjectionStoreConfig;

  constructor(
    logger: Logger,
    protected readonly projector: TProjector,
    config: Partial<ProjectionStoreConfig> = {},
  ) {
    this.logger = logger;
    this.config = {
      keyPrefix: 'projection',
      enableMetrics: true,
      healthCheckInterval: 30000, // 30 seconds
      ...config,
    };
  }

  /**
   * Get projection by key
   */
  async getProjection(key: string): Promise<TProjection | undefined> {
    try {
      const projection = this.projector.getProjection(key);

      if (!projection) {
        return undefined;
      }

      // Map internal projection format to interface format
      return this.mapToProjectionInterface(projection);
    } catch (error) {
      this.logError('getProjection', key, error as Error);
      return undefined;
    }
  }

  /**
   * Check if projection exists (optimized for existence checks)
   */
  async hasProjection(key: string): Promise<boolean> {
    try {
      const projection = this.projector.getProjection(key);
      return projection !== undefined && !this.isDeleted(projection);
    } catch (error) {
      this.logError('hasProjection', key, error as Error);
      return false;
    }
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<ProjectionStoreStats> {
    try {
      const metrics = this.projector.getMetrics();
      const allProjections = this.projector.getAllProjections();

      const cacheHitRate =
        metrics.hitCount + metrics.missCount > 0
          ? metrics.hitCount / (metrics.hitCount + metrics.missCount)
          : 0;

      return {
        totalProjections: allProjections.length,
        cacheHitRate,
        memoryUsageBytes: metrics.memoryUsageBytes,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logError('getStats', 'N/A', error as Error);
      return {
        totalProjections: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Health check - verify store is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check by getting metrics
      this.projector.getMetrics();
      return true;
    } catch (error) {
      this.logError('isHealthy', 'N/A', error as Error);
      return false;
    }
  }

  /**
   * Generate projection key for tenant and identifier
   * Override this in subclasses for domain-specific key formats
   */
  buildProjectionKey(tenantId: string, identifier: string): string {
    return `${tenantId}:${this.config.keyPrefix}:${identifier}`;
  }

  /**
   * Abstract method to map internal projection to interface format
   * Must be implemented by concrete store classes
   */
  protected abstract mapToProjectionInterface(
    internalProjection: TInternalProjection,
  ): TProjection;

  /**
   * Check if a projection is deleted
   * Override if internal projection has different deletion semantics
   */
  protected isDeleted(projection: TInternalProjection): boolean {
    // Default assumption: projection has deletedAt property
    return (projection as any).deletedAt != null;
  }

  /**
   * Standardized error logging
   */
  protected logError(method: string, key: string, error: Error): void {
    const logContext = {
      method,
      key,
      error: error.message,
      storeType: this.constructor.name,
    };

    // Use the shared Log utility for consistent logging
    Log.error(
      this.logger,
      `Failed to execute ${method} in projection store`,
      logContext,
    );
  }
}

// ============================================================================
// SIMPLE STORE - Direct, No Over-Engineering Approach
// ============================================================================

import { LRUCache } from './lru-cache';

/**
 * Simple Generic Store
 *
 * Direct, no-nonsense storage for any projections.
 * Used by both projectors (write) and repositories (read).
 *
 * This is the recommended approach over the complex abstractions above.
 * Use this for new implementations.
 */
export class SimpleStore<T extends BaseProjection> {
  private readonly cache: LRUCache<string, T>;
  private readonly storeName: string;

  constructor(maxSize: number = 5000, storeName: string = 'generic-store') {
    this.cache = new LRUCache<string, T>(maxSize);
    this.storeName = storeName;
  }

  /**
   * Get projection by tenant and code
   */
  get(tenantId: string, code: string): T | undefined {
    return this.cache.get(this.buildKey(tenantId, code));
  }

  /**
   * Set projection
   */
  set(tenantId: string, code: string, projection: T): void {
    this.cache.set(this.buildKey(tenantId, code), projection);
  }

  /**
   * Check if projection exists
   */
  has(tenantId: string, code: string): boolean {
    return this.cache.has(this.buildKey(tenantId, code));
  }

  /**
   * Delete projection (mark as deleted)
   */
  delete(tenantId: string, code: string): void {
    const existing = this.get(tenantId, code);
    if (existing) {
      existing.deletedAt = new Date();
      this.set(tenantId, code, existing);
    }
  }

  /**
   * Get all projections (for testing/debugging)
   */
  getAll(): Array<[string, T]> {
    return Array.from(this.cache.entries());
  }

  /**
   * Clear all projections
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current size
   */
  size(): number {
    return this.cache.size();
  }

  /**
   * Build consistent cache key
   */
  private buildKey(tenantId: string, code: string): string {
    return `${tenantId}:${this.storeName}:${code}`;
  }
}
