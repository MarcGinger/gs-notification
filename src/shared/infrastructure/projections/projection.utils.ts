// Shared Projection Utilities
// Common utility functions for all projectors

import { DomainError, withContext } from '../../errors';

/**
 * Common projector error definitions that can be reused across all projectors
 */
export const CommonProjectorErrorDefinitions = {
  INVALID_EVENT_DATA: {
    title: 'Invalid Event Data',
    detail: 'Event data does not conform to expected schema',
    category: 'application' as const,
    retryable: false,
  },
  DATABASE_OPERATION_FAILED: {
    title: 'Database Operation Failed',
    detail: 'Failed to execute database operation during projection',
    category: 'infrastructure' as const,
    retryable: true,
  },
  JSON_SERIALIZATION_FAILED: {
    title: 'JSON Serialization Failed',
    detail: 'Failed to serialize/deserialize JSON data',
    category: 'application' as const,
    retryable: false,
  },
} as const;

/**
 * Create a projector error catalog with a specific prefix
 *
 * @param projectorName - The name of the projector (e.g., 'PRODUCT_PROJECTOR')
 * @param errorDefinitions - The error definitions to use (defaults to CommonProjectorErrorDefinitions)
 * @returns Error catalog with properly prefixed error codes
 */
export function createProjectorErrorCatalog<T extends Record<string, any>>(
  projectorName: string,
  errorDefinitions = CommonProjectorErrorDefinitions,
) {
  return Object.fromEntries(
    Object.entries(errorDefinitions).map(([key, errorDef]) => {
      const code = `${projectorName}.${key}` as const;
      return [key, { ...errorDef, code }];
    }),
  ) as {
    [K in keyof T]: DomainError<`${typeof projectorName}.${Extract<K, string>}`>;
  };
}

/**
 * Projection utility error definitions (internal use)
 */
const ProjectionUtilErrorDefinitions = {
  JSON_SERIALIZATION_FAILED:
    CommonProjectorErrorDefinitions.JSON_SERIALIZATION_FAILED,
} as const;

/**
 * Projection utility error catalog
 */
const ProjectionUtilErrors = Object.fromEntries(
  Object.entries(ProjectionUtilErrorDefinitions).map(([key, errorDef]) => {
    const code = `PROJECTION_UTIL.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof ProjectionUtilErrorDefinitions]: DomainError<`PROJECTION_UTIL.${Extract<K, string>}`>;
};

/**
 * Safe JSON stringify with proper error handling
 *
 * @param value - The value to stringify
 * @returns JSON string representation
 * @throws Error with domain context if serialization fails
 */
export function safeJsonStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    const e = error as Error;
    throw new Error(
      withContext(ProjectionUtilErrors.JSON_SERIALIZATION_FAILED, {
        originalError: e.message,
        value: String(value),
      }).detail,
    );
  }
}

/**
 * Safe JSON parse with proper error handling
 *
 * @param json - The JSON string to parse
 * @returns Parsed object
 * @throws Error with domain context if parsing fails
 */
export function safeJsonParse<T = any>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const e = error as Error;
    throw new Error(
      withContext(ProjectionUtilErrors.JSON_SERIALIZATION_FAILED, {
        originalError: e.message,
        value: json.substring(0, 100) + (json.length > 100 ? '...' : ''),
      }).detail,
    );
  }
}

/**
 * Health status interface for projectors
 */
export interface ProjectorHealthStatus {
  isHealthy: boolean;
  lastProcessedAt: Date | null;
  eventsProcessed: number;
  lastError: string | null;
  checkpointPosition: string | null;
  isRunning: boolean;
  projectorName: string;
  subscriptionGroup: string;
}

/**
 * Base health status structure
 */
export interface BaseHealthStatus {
  isHealthy: boolean;
  lastProcessedAt: Date | null;
  eventsProcessed: number;
  lastError: string | null;
  checkpointPosition: string | null;
}

// Re-export shared utilities for easier access
export {
  ProjectorCacheAdapter,
  ProjectorCacheKeyGenerators,
} from './cache/projector-cache-adapter';
export { TenantExtractor } from './validation/tenant-extractor';
export {
  RedisHashBuilder,
  RedisPipelineOperations,
  RedisKeyPatterns,
} from './redis/redis-projection-helpers';
