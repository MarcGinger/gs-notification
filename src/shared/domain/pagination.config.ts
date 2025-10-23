/**
 * Pagination configuration settings for application-wide consistency
 *
 * This configuration provides centralized control over pagination limits
 * and defaults across all list operations in the application.
 *
 * @domain Shared - Configuration
 * @layer Domain
 * @pattern Configuration Object
 */
export interface PaginationConfig {
  /** Default page size when not specified */
  readonly defaultPageSize: number;
  /** Maximum allowed page size to prevent performance issues */
  readonly maxPageSize: number;
  /** Default page number (1-based) */
  readonly defaultPage: number;
  /** Maximum allowed page number */
  readonly maxPage: number;
}

/**
 * Default pagination configuration
 * These values can be overridden by environment variables or configuration files
 */
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  defaultPageSize: 20,
  maxPageSize: 100,
  defaultPage: 1,
  maxPage: 10000, // Reasonable limit to prevent abuse
};

/**
 * Cache configuration for list operations
 */
export interface ListCacheConfig {
  /** Default TTL for list queries in seconds */
  readonly defaultTtl: number;
  /** Whether to enable caching by default */
  readonly enableByDefault: boolean;
}

/**
 * Default cache configuration for lists
 */
export const DEFAULT_LIST_CACHE_CONFIG: ListCacheConfig = {
  defaultTtl: 120, // 2 minutes
  enableByDefault: true,
};
