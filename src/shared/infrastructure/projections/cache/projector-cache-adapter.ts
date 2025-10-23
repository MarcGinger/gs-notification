// Generic Projector Cache Adapter
// Provides reusable caching patterns for all projectors

import { CacheService } from 'src/shared/application/caching/cache.service';

/**
 * Cache key generators for projector optimization
 * Reusable across all projector types
 */
export class ProjectorCacheKeyGenerators {
  /**
   * Generate deduplication key for event processing
   */
  static dedupKey(
    projectorPrefix: string,
    tenant: string,
    stream: string,
    rev: number | string,
  ): string {
    return `${projectorPrefix}:dedup:${tenant}:${stream}:${rev}`;
  }

  /**
   * Generate version hint key for optimistic concurrency
   */
  static versionKey(
    projectorPrefix: string,
    tenant: string,
    entityType: string,
    code: string,
  ): string {
    return `${projectorPrefix}:ver:${tenant}:${entityType}:${code}`;
  }

  /**
   * Generate tenant metadata key
   */
  static tenantMetaKey(projectorPrefix: string, tenant: string): string {
    return `${projectorPrefix}:tenant:${tenant}:meta`;
  }
}

/**
 * Generic Cache Adapter for Projector Optimization Patterns
 *
 * Provides common caching operations used across all projectors:
 * - Event deduplication
 * - Version hints for optimistic concurrency
 * - Tenant metadata caching
 */
export class ProjectorCacheAdapter {
  constructor(
    private readonly cache: CacheService,
    private readonly projectorPrefix: string,
  ) {}

  /**
   * Mark an event as seen to prevent duplicate processing
   *
   * @param tenant - Tenant identifier
   * @param stream - Stream identifier
   * @param revision - Event revision
   * @param ttlSeconds - TTL for deduplication (default 48 hours)
   * @returns true if this is the first time seeing this event, false if duplicate
   */
  async markSeenOnce(
    tenant: string,
    stream: string,
    revision: number | string,
    ttlSeconds = 60 * 60 * 48,
  ): Promise<boolean> {
    const key = ProjectorCacheKeyGenerators.dedupKey(
      this.projectorPrefix,
      tenant,
      stream,
      revision,
    );

    const seen = await this.cache.exists(key);
    if (seen) return false;

    await this.cache.set(key, 1, ttlSeconds); // NX not available; race is OK—later logic still protects
    return true;
  }

  /**
   * Get projected version for optimistic concurrency control
   *
   * @param tenant - Tenant identifier
   * @param entityType - Type of entity (e.g., 'product', 'channel')
   * @param code - Entity code/identifier
   * @returns Version number or null if not found
   */
  async getProjectedVersion(
    tenant: string,
    entityType: string,
    code: string,
  ): Promise<number | null> {
    const key = ProjectorCacheKeyGenerators.versionKey(
      this.projectorPrefix,
      tenant,
      entityType,
      code,
    );

    const version = await this.cache.get<string | number>(key);
    return version == null ? null : Number(version);
  }

  /**
   * Set projected version for optimistic concurrency control
   *
   * @param tenant - Tenant identifier
   * @param entityType - Type of entity (e.g., 'product', 'channel')
   * @param code - Entity code/identifier
   * @param version - Version number to set
   */
  async setProjectedVersion(
    tenant: string,
    entityType: string,
    code: string,
    version: number,
  ): Promise<void> {
    const key = ProjectorCacheKeyGenerators.versionKey(
      this.projectorPrefix,
      tenant,
      entityType,
      code,
    );

    await this.cache.set(key, version);
  }

  /**
   * Get tenant metadata for projector-specific tenant information
   *
   * @param tenant - Tenant identifier
   * @returns Tenant metadata or null if not found
   */
  async getTenantMeta<T>(tenant: string): Promise<T | null> {
    const key = ProjectorCacheKeyGenerators.tenantMetaKey(
      this.projectorPrefix,
      tenant,
    );

    return await this.cache.get<T>(key);
  }

  /**
   * Set tenant metadata for projector-specific tenant information
   *
   * @param tenant - Tenant identifier
   * @param meta - Metadata to store
   * @param ttlSeconds - TTL for metadata (default 30 minutes)
   */
  async setTenantMeta<T>(
    tenant: string,
    meta: T,
    ttlSeconds = 30 * 60,
  ): Promise<void> {
    const key = ProjectorCacheKeyGenerators.tenantMetaKey(
      this.projectorPrefix,
      tenant,
    );

    await this.cache.set(key, meta, ttlSeconds);
  }

  /**
   * Clear all cache entries for a specific tenant
   * Useful for tenant cleanup or data reset scenarios
   *
   * @param tenant - Tenant identifier
   */
  clearTenantCache(tenant: string): void {
    // Note: This requires cache service to support pattern-based deletion
    // Implementation depends on cache backend (Redis supports this, memory cache may need iteration)
    const pattern = `${this.projectorPrefix}:*:${tenant}:*`;

    // CacheService interface does not support pattern deletion
    // This would require Redis-specific implementation
    console.warn(`Cache cleanup not implemented for pattern: ${pattern}`);
    // TODO: Implement when CacheService supports pattern deletion
  }
}
