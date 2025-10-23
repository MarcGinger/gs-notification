/**
 * Cache configuration constants and utilities for repository operations
 * Replaces magic numbers with properly configured cache TTL values
 */

/**
 * Standard cache TTL values in seconds
 */
export const CACHE_TTL = {
  /** Short-lived cache for frequently changing data (1 minute) */
  SHORT: 60,
  /** Standard cache for regular operations (5 minutes) */
  STANDARD: 300,
  /** Medium-term cache for semi-static data (10 minutes) */
  MEDIUM: 600,
  /** Long-term cache for rarely changing data (30 minutes) */
  LONG: 1800,
  /** Extended cache for very stable data (1 hour) */
  EXTENDED: 3600,
} as const;

/**
 * Environment-specific cache multipliers
 */
export const CACHE_MULTIPLIERS = {
  development: 0.5, // Shorter cache in dev for faster feedback
  test: 0.1, // Very short cache in tests
  staging: 1.0, // Standard cache in staging
  production: 1.0, // Full cache in production
} as const;

/**
 * Cache configuration for repository operations
 */
export interface RepositoryCacheConfig {
  /** Cache TTL for read operations */
  readTtl: number;
  /** Cache TTL for list operations */
  listTtl: number;
  /** Cache TTL for search operations */
  searchTtl: number;
  /** Cache TTL for aggregate operations */
  aggregateTtl: number;
}

/**
 * Default repository cache configuration
 */
export const DEFAULT_REPOSITORY_CACHE_CONFIG: RepositoryCacheConfig = {
  readTtl: CACHE_TTL.STANDARD,
  listTtl: CACHE_TTL.MEDIUM,
  searchTtl: CACHE_TTL.SHORT,
  aggregateTtl: CACHE_TTL.LONG,
};

/**
 * Cache operation types
 */
export type CacheOperation = 'read' | 'list' | 'search' | 'aggregate';

/**
 * Get cache TTL for specific operation type
 */
export function getCacheTtlForOperation(operation: CacheOperation): number {
  const config = DEFAULT_REPOSITORY_CACHE_CONFIG;

  switch (operation) {
    case 'read':
      return config.readTtl;
    case 'list':
      return config.listTtl;
    case 'search':
      return config.searchTtl;
    case 'aggregate':
      return config.aggregateTtl;
    default:
      return CACHE_TTL.STANDARD;
  }
}

/**
 * Get environment-adjusted cache configuration
 */
export function getCacheConfigForEnvironment(
  env: keyof typeof CACHE_MULTIPLIERS = 'production',
): RepositoryCacheConfig {
  const multiplier = CACHE_MULTIPLIERS[env] || 1.0;

  return {
    readTtl: Math.floor(DEFAULT_REPOSITORY_CACHE_CONFIG.readTtl * multiplier),
    listTtl: Math.floor(DEFAULT_REPOSITORY_CACHE_CONFIG.listTtl * multiplier),
    searchTtl: Math.floor(
      DEFAULT_REPOSITORY_CACHE_CONFIG.searchTtl * multiplier,
    ),
    aggregateTtl: Math.floor(
      DEFAULT_REPOSITORY_CACHE_CONFIG.aggregateTtl * multiplier,
    ),
  };
}

/**
 * Get cache TTL with environment adjustment and fallback
 */
export function getCacheTtl(
  operation?: CacheOperation,
  fallback: number = CACHE_TTL.STANDARD,
): number {
  return operation ? getCacheTtlForOperation(operation) : fallback;
}
