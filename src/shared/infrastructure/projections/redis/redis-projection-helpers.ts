// Redis Projection Utilities
// Generic Redis operations for projectors

import { ChainableCommander } from 'ioredis';
import { safeJsonStringify } from '../projection.utils';

/**
 * Redis Hash Field Builder - Helps build Redis hash fields with proper serialization
 */
export class RedisHashBuilder {
  private fields: Record<string, string | number> = {};

  /**
   * Add a string field to the hash
   */
  addString(key: string, value: string): this {
    this.fields[key] = value;
    return this;
  }

  /**
   * Add a number field to the hash
   */
  addNumber(key: string, value: number): this {
    this.fields[key] = value;
    return this;
  }

  /**
   * Add a boolean field to the hash (stored as 0/1)
   */
  addBoolean(key: string, value: boolean): this {
    this.fields[key] = value ? 1 : 0;
    return this;
  }

  /**
   * Add an object field to the hash (JSON serialized)
   */
  addObject(key: string, value: any): this {
    this.fields[key] = safeJsonStringify(value);
    return this;
  }

  /**
   * Add a date field to the hash (ISO string)
   */
  addDate(key: string, value: Date): this {
    this.fields[key] = value.toISOString();
    return this;
  }

  /**
   * Add an optional field only if it has a value
   */
  addOptional(
    key: string,
    value: any,
    serializer?: (val: any) => string | number,
  ): this {
    if (value !== undefined && value !== null) {
      if (serializer) {
        this.fields[key] = serializer(value);
      } else if (typeof value === 'object') {
        this.fields[key] = safeJsonStringify(value);
      } else {
        this.fields[key] = value;
      }
    }
    return this;
  }

  /**
   * Get the built hash fields
   */
  build(): Record<string, string | number> {
    return { ...this.fields };
  }

  /**
   * Reset the builder for reuse
   */
  reset(): this {
    this.fields = {};
    return this;
  }
}

/**
 * Redis Pipeline Operations - Generic patterns for projector Redis operations
 */
export class RedisPipelineOperations {
  /**
   * Add version check operation to pipeline using Lua script
   *
   * @param pipeline - Redis pipeline
   * @param key - Redis key to check
   * @param newVersion - New version to validate against
   * @returns Pipeline for chaining
   */
  static addVersionCheck(
    pipeline: ChainableCommander,
    key: string,
    newVersion: number,
  ): ChainableCommander {
    const versionCheckScript = `
      local key = KEYS[1]
      local newVersion = tonumber(ARGV[1])
      local currentVersion = redis.call('HGET', key, 'version')
      
      if not currentVersion or tonumber(currentVersion) < newVersion then
        return 1  -- Allow update
      else
        return 0  -- Reject update (stale version)
      end
    `;

    return pipeline.eval(versionCheckScript, 1, key, newVersion.toString());
  }

  /**
   * Add hash set operation to pipeline with built fields
   *
   * @param pipeline - Redis pipeline
   * @param key - Redis key
   * @param fields - Hash fields to set
   * @returns Pipeline for chaining
   */
  static addHashSet(
    pipeline: ChainableCommander,
    key: string,
    fields: Record<string, string | number>,
  ): ChainableCommander {
    return pipeline.hmset(key, fields);
  }

  /**
   * Add sorted set operation to pipeline (for indexing)
   *
   * @param pipeline - Redis pipeline
   * @param indexKey - Sorted set key
   * @param score - Sort score (typically timestamp)
   * @param member - Set member (typically entity code)
   * @returns Pipeline for chaining
   */
  static addSortedSetIndex(
    pipeline: ChainableCommander,
    indexKey: string,
    score: number,
    member: string,
  ): ChainableCommander {
    return pipeline.zadd(indexKey, score, member);
  }

  /**
   * Add expiration operation to pipeline
   *
   * @param pipeline - Redis pipeline
   * @param key - Redis key to expire
   * @param ttlSeconds - TTL in seconds
   * @returns Pipeline for chaining
   */
  static addExpiration(
    pipeline: ChainableCommander,
    key: string,
    ttlSeconds: number,
  ): ChainableCommander {
    return pipeline.expire(key, ttlSeconds);
  }

  /**
   * Add persist operation to pipeline (remove expiration)
   *
   * @param pipeline - Redis pipeline
   * @param key - Redis key to persist
   * @returns Pipeline for chaining
   */
  static addPersist(
    pipeline: ChainableCommander,
    key: string,
  ): ChainableCommander {
    return pipeline.persist(key);
  }

  /**
   * Add remove from sorted set operation to pipeline
   *
   * @param pipeline - Redis pipeline
   * @param indexKey - Sorted set key
   * @param member - Member to remove
   * @returns Pipeline for chaining
   */
  static addRemoveFromIndex(
    pipeline: ChainableCommander,
    indexKey: string,
    member: string,
  ): ChainableCommander {
    return pipeline.zrem(indexKey, member);
  }

  /**
   * Build a complete projection update pipeline
   *
   * @param pipeline - Redis pipeline
   * @param config - Pipeline configuration
   * @returns Pipeline for chaining
   */
  static buildProjectionPipeline(
    pipeline: ChainableCommander,
    config: {
      entityKey: string;
      indexKey: string;
      fields: Record<string, string | number>;
      entityCode: string;
      timestamp: number;
      version?: number;
      isUpdate?: boolean;
      isDeleted?: boolean;
      deleteTtlSeconds?: number;
    },
  ): ChainableCommander {
    const {
      entityKey,
      indexKey,
      fields,
      entityCode,
      timestamp,
      version,
      isUpdate = false,
      isDeleted = false,
      deleteTtlSeconds = 30 * 24 * 60 * 60, // 30 days default
    } = config;

    // Add version check for updates
    if (isUpdate && version !== undefined) {
      this.addVersionCheck(pipeline, entityKey, version);
    }

    // Store entity data
    this.addHashSet(pipeline, entityKey, fields);

    if (isDeleted) {
      // Handle soft delete
      this.addExpiration(pipeline, entityKey, deleteTtlSeconds);
      this.addRemoveFromIndex(pipeline, indexKey, entityCode);
    } else {
      // Handle active entity
      this.addPersist(pipeline, entityKey);
      this.addSortedSetIndex(pipeline, indexKey, timestamp, entityCode);
    }

    return pipeline;
  }
}

/**
 * Redis Key Patterns - Common key generation patterns for projections
 */
export class RedisKeyPatterns {
  /**
   * Generate entity hash key
   *
   * @param projectorPrefix - Projector name prefix
   * @param tenant - Tenant identifier
   * @param entityType - Entity type (e.g., 'product', 'channel')
   * @param entityCode - Entity code/identifier
   * @returns Redis key for entity hash
   */
  static entityKey(
    projectorPrefix: string,
    tenant: string,
    entityType: string,
    entityCode: string,
  ): string {
    return `${projectorPrefix}:${entityType}:${tenant}:${entityCode}`;
  }

  /**
   * Generate tenant index key (sorted set)
   *
   * @param projectorPrefix - Projector name prefix
   * @param tenant - Tenant identifier
   * @param entityType - Entity type (e.g., 'product', 'channel')
   * @returns Redis key for tenant index sorted set
   */
  static tenantIndexKey(
    projectorPrefix: string,
    tenant: string,
    entityType: string,
  ): string {
    return `${projectorPrefix}:index:${entityType}:${tenant}`;
  }

  /**
   * Generate global index key (sorted set across all tenants)
   *
   * @param projectorPrefix - Projector name prefix
   * @param entityType - Entity type (e.g., 'product', 'channel')
   * @returns Redis key for global index sorted set
   */
  static globalIndexKey(projectorPrefix: string, entityType: string): string {
    return `${projectorPrefix}:index:${entityType}:global`;
  }

  /**
   * Generate type-specific index key
   *
   * @param projectorPrefix - Projector name prefix
   * @param entityType - Entity type
   * @param indexType - Index type (e.g., 'by_category', 'by_status')
   * @param indexValue - Index value
   * @returns Redis key for type-specific index
   */
  static typeIndexKey(
    projectorPrefix: string,
    entityType: string,
    indexType: string,
    indexValue: string,
  ): string {
    return `${projectorPrefix}:index:${entityType}:${indexType}:${indexValue}`;
  }
}
