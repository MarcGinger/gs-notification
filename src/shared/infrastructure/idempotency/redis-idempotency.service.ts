/**
 * Generic Redis Idempotency Service
 *
 * Implements SETNX-based patterns for:
 * - Dispatch-once (projector): Prevent duplicate job enqueuing
 * - Execution-lock (worker): Prevent concurrent processing
 *
 * All keys use tenant hash-tags for Redis cluster locality.
 * Supports configurable namespaces for different contexts.
 */

import { Injectable, Inject } from '@nestjs/common';
import { APP_LOGGER, Log, Logger, componentLogger } from 'src/shared/logging';
import Redis from 'ioredis';
import type {
  IdempotencyConfig,
  IdempotencyResult,
  IRedisIdempotencyService,
} from './idempotency.interfaces';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  /** Default execution lock TTL (15 minutes) */
  EXECUTION_TTL_SECONDS: 900,

  /** Redis value for successful lock acquisition */
  LOCK_VALUE: '1',
} as const;

/**
 * Redis key generation utilities
 */
class IdempotencyKeyBuilder {
  constructor(private readonly config: IdempotencyConfig) {}

  /**
   * Generate dispatch-once key
   */
  dispatchKey(tenant: string, entityId: string): string {
    return `${this.config.namespace}:${this.config.version}:{${tenant}}:${this.config.entityType}:${entityId}:dispatched`;
  }

  /**
   * Generate execution lock key
   */
  executionKey(tenant: string, entityId: string): string {
    return `${this.config.namespace}:${this.config.version}:{${tenant}}:${this.config.entityType}:${entityId}:execute-lock`;
  }
}

@Injectable()
export class RedisIdempotencyService implements IRedisIdempotencyService {
  private readonly logger: Logger;
  private readonly keyBuilder: IdempotencyKeyBuilder;
  private readonly executionTtl: number;

  constructor(
    @Inject('IDEMPOTENCY_CONFIG') private readonly config: IdempotencyConfig,
    @Inject(APP_LOGGER) private readonly baseLogger: Logger,
    @Inject('REDIS') private readonly redis: Redis,
  ) {
    this.logger = componentLogger(baseLogger, 'RedisIdempotencyService');
    this.keyBuilder = new IdempotencyKeyBuilder(config);
    this.executionTtl =
      config.executionTtl ?? DEFAULT_CONFIG.EXECUTION_TTL_SECONDS;
  }

  /**
   * Attempt to acquire dispatch-once lock for job enqueuing
   */
  async acquireDispatchLock(
    tenant: string,
    entityId: string,
  ): Promise<IdempotencyResult> {
    const key = this.keyBuilder.dispatchKey(tenant, entityId);

    try {
      // SETNX: Set if Not eXists (atomic operation)
      const result = await this.redis.setnx(key, DEFAULT_CONFIG.LOCK_VALUE);

      const isFirst = result === 1; // Only first caller gets result === 1

      Log.debug(this.logger, `Dispatch lock attempt`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        isFirst,
      });

      return {
        success: true, // Operation succeeded (even if lock not acquired)
        isFirst,
      };
    } catch (error) {
      Log.error(this.logger, `Failed to acquire dispatch lock`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        isFirst: false,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Attempt to acquire execution lock for processing
   */
  async acquireExecutionLock(
    tenant: string,
    entityId: string,
  ): Promise<IdempotencyResult> {
    const key = this.keyBuilder.executionKey(tenant, entityId);

    try {
      // SETNX with TTL: Set if Not eXists with expiration
      const result = await this.redis.set(
        key,
        DEFAULT_CONFIG.LOCK_VALUE,
        'EX',
        this.executionTtl,
        'NX',
      );

      const isFirst = result === 'OK'; // Only first caller gets 'OK'

      Log.debug(this.logger, `Execution lock attempt`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        ttl: this.executionTtl,
        isFirst,
      });

      return {
        success: true, // Operation succeeded (even if lock not acquired)
        isFirst,
      };
    } catch (error) {
      Log.error(this.logger, `Failed to acquire execution lock`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        isFirst: false,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Release execution lock (optional cleanup)
   */
  async releaseExecutionLock(
    tenant: string,
    entityId: string,
  ): Promise<IdempotencyResult> {
    const key = this.keyBuilder.executionKey(tenant, entityId);

    try {
      const result = await this.redis.del(key);
      const wasDeleted = result === 1;

      Log.debug(this.logger, `Execution lock release`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        wasDeleted,
      });

      return {
        success: true,
        isFirst: wasDeleted, // True if lock existed and was deleted
      };
    } catch (error) {
      Log.error(this.logger, `Failed to release execution lock`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        isFirst: false,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Check if dispatch lock exists
   */
  async hasDispatchLock(tenant: string, entityId: string): Promise<boolean> {
    const key = this.keyBuilder.dispatchKey(tenant, entityId);

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      Log.error(this.logger, `Failed to check dispatch lock`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false; // Assume no lock on error
    }
  }

  /**
   * Check if execution lock exists
   */
  async hasExecutionLock(tenant: string, entityId: string): Promise<boolean> {
    const key = this.keyBuilder.executionKey(tenant, entityId);

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      Log.error(this.logger, `Failed to check execution lock`, {
        namespace: this.config.namespace,
        entityType: this.config.entityType,
        tenant,
        entityId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false; // Assume no lock on error
    }
  }
}
