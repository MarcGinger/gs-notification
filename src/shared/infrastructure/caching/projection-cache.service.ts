/**
 * Projection Cache Service Interface
 *
 * Provides caching capabilities specifically optimized for projection operations
 * including event deduplication, version hints, and metadata caching
 */

export interface ProjectionCacheService {
  // Event Deduplication
  isOperationProcessed(operationId: string): Promise<boolean>;
  markOperationProcessed(
    operationId: string,
    ttlSeconds?: number,
  ): Promise<void>;

  // Version Hints (Optimistic Concurrency)
  getVersionHint(entityKey: string): Promise<number | null>;
  setVersionHint(
    entityKey: string,
    version: number,
    ttlSeconds?: number,
  ): Promise<void>;

  // Metadata Caching
  getMetadata<T>(key: string): Promise<T | null>;
  setMetadata<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  // Pattern-based Operations
  clearPattern(pattern: string): Promise<void>;
  getStats(): Promise<ProjectionCacheStats>;
}

export interface ProjectionCacheStats {
  hitRate: number;
  missRate: number;
  size: number;
  operationCacheSize: number;
  versionCacheSize: number;
  metadataCacheSize: number;
  memoryUsage?: number;
}
