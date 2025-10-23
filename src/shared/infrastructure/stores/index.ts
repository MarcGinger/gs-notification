/**
 * Shared Infrastructure Components for Projection Systems
 *
 * This module exports reusable store components for projection systems
 * that can be used across different repositories and domains.
 *
 * Components:
 * - InMemoryCheckpointStore: Zero-dependency checkpoint storage
 * - LRUCache: Generic bounded cache with eviction policies
 * - ProjectionMetrics: Comprehensive metrics and observability
 * - ShadowModeValidator: Validation and comparison framework
 * - BaseInMemoryProjectionStore: Generic abstraction for in-memory projection stores
 *
 * Use Cases:
 * - Cross-repository reuse of projection infrastructure
 * - Testing and prototyping scenarios
 * - Migration and validation workflows
 * - Performance monitoring and benchmarking
 * - Shadow mode and canary testing
 * - Generic projection store implementations
 */

// Checkpoint Store Components
export { InMemoryCheckpointStore } from './in-memory-checkpoint.store';

// Cache Components
export { LRUCache } from './lru-cache';

// Metrics and Observability
export {
  ProjectionMetrics,
  ExtendedProjectionMetrics,
  ProjectionMetricsCollector,
  ShadowModeMetrics,
  ShadowModeMetricsCollector,
} from './projection-metrics';

// Shadow Mode and Validation
export {
  ShadowModeConfig,
  ComparisonResult,
  ComparisonDifference,
  ShadowModeCallback,
  ShadowModeValidator,
  ShadowModeFactory,
} from './shadow-mode';

// Import for internal use
import { InMemoryCheckpointStore } from './in-memory-checkpoint.store';
import { LRUCache } from './lru-cache';
import { ProjectionMetricsCollector } from './projection-metrics';
import { ShadowModeValidator, ShadowModeConfig } from './shadow-mode';

// Type definitions for common projection patterns
export interface ProjectionStoreStats {
  entityCount: number;
  memoryUsageBytes: number;
  cacheHitRate?: number;
  evictionCount?: number;
}

export interface ProjectionStoreConfig {
  maxCacheSize?: number;
  enableMetrics?: boolean;
  enableShadowMode?: boolean;
  shadowModeConfig?: Partial<ShadowModeConfig>;
}

// Utility types for cross-repository compatibility
export type ProjectionKey = string;
export type ProjectionData = Record<string, any>;
export type ProjectionTimestamp = Date;

// Factory function for creating complete in-memory projection stores
export interface InMemoryProjectionStoreOptions {
  maxCacheSize?: number;
  enableMetrics?: boolean;
  enableShadowMode?: boolean;
  shadowModeConfig?: Partial<ShadowModeConfig>;
}

/**
 * Factory for creating complete in-memory projection store with all components
 */
export function createInMemoryProjectionStore<T = ProjectionData>(
  options: InMemoryProjectionStoreOptions = {},
) {
  const {
    maxCacheSize = 10000,
    enableMetrics = true,
    enableShadowMode = false,
    shadowModeConfig = {},
  } = options;

  const cache = new LRUCache<ProjectionKey, T>(maxCacheSize);
  const checkpointStore = new InMemoryCheckpointStore();
  const metricsCollector = enableMetrics
    ? new ProjectionMetricsCollector()
    : undefined;
  const shadowValidator = enableShadowMode
    ? new ShadowModeValidator<T>(shadowModeConfig)
    : undefined;

  return {
    cache,
    checkpointStore,
    metricsCollector,
    shadowValidator,

    // Convenience methods
    getStats(): ProjectionStoreStats {
      return {
        entityCount: cache.size(),
        memoryUsageBytes: cache.size() * 512, // Rough estimate
        cacheHitRate: metricsCollector?.getMetrics().hitCount || 0,
        evictionCount: metricsCollector?.getMetrics().evictionCount || 0,
      };
    },

    async reset(): Promise<void> {
      cache.clear();
      await checkpointStore.clear();
      metricsCollector?.reset();
      shadowValidator?.reset();
    },

    enableShadowMode(): void {
      shadowValidator?.enable();
    },

    disableShadowMode(): void {
      shadowValidator?.disable();
    },
  };
}

// Re-export commonly used types from dependencies
export type { CheckpointStore } from '../projections/checkpoint.store';

// Export the new generic projection store abstractions
export * from './base-in-memory-projection.store';
