/**
 * Repository Execution Utilities - Shared Helper Methods
 *
 * Provides common execution patterns for repositories and services including
 * timeout handling, cache key generation, and other reusable functionality.
 *
 * @domain Shared Infrastructure
 * @layer Infrastructure - Utilities
 * @pattern Utility Helper
 */
export class RepositoryExecutionUtil {
  /**
   * Execute a promise with optional timeout
   *
   * @param queryPromise - The promise to execute
   * @param timeout - Optional timeout in milliseconds
   * @param timeoutMessage - Custom timeout error message
   * @returns Promise that resolves with the result or rejects with timeout error
   *
   * @example
   * ```typescript
   * const result = await RepositoryExecutionUtil.executeWithTimeout(
   *   dataSource.query(sql, params),
   *   5000,
   *   'Database query timeout'
   * );
   * ```
   */
  static async executeWithTimeout<T>(
    queryPromise: Promise<T>,
    timeout?: number,
    timeoutMessage: string = 'Operation timeout',
  ): Promise<T> {
    if (!timeout) {
      return queryPromise;
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeout),
    );

    return Promise.race([queryPromise, timeoutPromise]);
  }

  /**
   * Generate consistent cache key for repository operations
   *
   * @param component - The component/repository name (e.g., 'channel-reader', 'user-service')
   * @param operation - The operation name (e.g., 'findById', 'validateCodes')
   * @param params - Parameters to include in the cache key
   * @param options - Optional cache key generation options
   * @returns Consistent cache key string
   *
   * @example
   * ```typescript
   * const key = RepositoryExecutionUtil.generateCacheKey(
   *   'user-repository',
   *   'findByEmail',
   *   { email: 'user@example.com', tenant: '123' }
   * );
   * // Result: "user-repository:findByEmail:{"email":"user@example.com","tenant":"123"}"
   * ```
   */
  static generateCacheKey(
    component: string,
    operation: string,
    params: Record<string, unknown>,
    options: CacheKeyOptions = {},
  ): string {
    const {
      sortKeys = true,
      includeTimestamp = false,
      prefix,
      maxLength,
    } = options;

    // Sort parameters for consistent keys if requested
    const sortedParams = sortKeys
      ? Object.keys(params)
          .sort()
          .reduce(
            (sorted, key) => {
              sorted[key] = params[key];
              return sorted;
            },
            {} as Record<string, unknown>,
          )
      : params;

    // Build key parts
    const keyParts = [
      prefix,
      component,
      operation,
      JSON.stringify(sortedParams),
    ].filter(Boolean);

    if (includeTimestamp) {
      keyParts.push(Date.now().toString());
    }

    let cacheKey = keyParts.join(':');

    // Truncate if max length specified
    if (maxLength && cacheKey.length > maxLength) {
      // Keep the prefix and truncate the JSON part
      const prefixPart = `${prefix ? prefix + ':' : ''}${component}:${operation}:`;
      const remainingLength = maxLength - prefixPart.length - 10; // Reserve space for hash
      const truncatedParams = JSON.stringify(sortedParams).substring(
        0,
        remainingLength,
      );
      const hash = this.simpleHash(JSON.stringify(sortedParams));
      cacheKey = `${prefixPart}${truncatedParams}...#${hash}`;
    }

    return cacheKey;
  }

  /**
   * Execute multiple promises with individual timeouts
   *
   * @param operations - Array of operations with their timeouts
   * @returns Promise that resolves with all results
   *
   * @example
   * ```typescript
   * const results = await RepositoryExecutionUtil.executeMultipleWithTimeout([
   *   { promise: getUserById(1), timeout: 1000 },
   *   { promise: getUserPreferences(1), timeout: 2000 },
   * ]);
   * ```
   */
  static async executeMultipleWithTimeout<T>(
    operations: Array<{
      promise: Promise<T>;
      timeout?: number;
      timeoutMessage?: string;
    }>,
  ): Promise<T[]> {
    const promises = operations.map((op) =>
      this.executeWithTimeout(op.promise, op.timeout, op.timeoutMessage),
    );

    return Promise.all(promises);
  }

  /**
   * Execute promises in batches with timeout per batch
   *
   * @param promises - Array of promises to execute
   * @param batchSize - Number of promises to execute concurrently
   * @param timeoutPerBatch - Timeout for each batch in milliseconds
   * @returns Promise that resolves with all results
   */
  static async executeBatched<T>(
    promises: Promise<T>[],
    batchSize: number = 10,
    timeoutPerBatch?: number,
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += batchSize) {
      const batch = promises.slice(i, i + batchSize);
      const batchPromise = Promise.all(batch);

      const batchResults = await this.executeWithTimeout(
        batchPromise,
        timeoutPerBatch,
        `Batch timeout (batch ${Math.floor(i / batchSize) + 1})`,
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Simple hash function for cache key generation
   * @private
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }
}

/**
 * Options for cache key generation
 */
export interface CacheKeyOptions {
  /**
   * Whether to sort parameter keys for consistent cache keys
   * @default true
   */
  sortKeys?: boolean;

  /**
   * Whether to include timestamp in cache key (for time-based invalidation)
   * @default false
   */
  includeTimestamp?: boolean;

  /**
   * Optional prefix for all cache keys
   */
  prefix?: string;

  /**
   * Maximum length for cache keys (will be truncated with hash if exceeded)
   */
  maxLength?: number;
}

/**
 * Timeout configuration for operations
 */
export interface TimeoutConfig {
  /**
   * Default timeout for all operations (ms)
   */
  default?: number;

  /**
   * Timeout for read operations (ms)
   */
  read?: number;

  /**
   * Timeout for write operations (ms)
   */
  write?: number;

  /**
   * Timeout for validation operations (ms)
   */
  validation?: number;
}
