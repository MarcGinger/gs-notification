/**
 * Redis Idempotency Key Services for MessageRequest Processing
 *
 * Implements SETNX-based patterns for:
 * - Dispatch-once (projector): Prevent duplicate job enqueuing
 * - Send-lock (worker): Prevent concurrent message sending
 *
 * All keys use tenant hash-tags for Redis cluster locality.
 */

import { Injectable, Inject } from '@nestjs/common';
import { APP_LOGGER, Log, Logger, componentLogger } from 'src/shared/logging';
import Redis from 'ioredis';
import { SLACK_REQUEST_DI_TOKENS } from '../../../slack-request.constants';

/**
 * Redis Key Templates
 * Using {tenant} hash-tag for cluster slot locality
 */
const REDIS_KEYS = {
  /** Dispatch-once key: prevents duplicate job enqueuing */
  DISPATCH_ONCE: (tenant: string, messageRequestId: string) =>
    `notification.slack:v1:{${tenant}}:message-request:${messageRequestId}:dispatched`,

  /** Send-lock key: prevents concurrent message sending */
  SEND_LOCK: (tenant: string, messageRequestId: string) =>
    `notification.slack:v1:{${tenant}}:message-request:${messageRequestId}:send-lock`,
} as const;

/**
 * Lock Configuration
 */
const LOCK_CONFIG = {
  /** Send-lock TTL (15 minutes) - prevents stuck jobs */
  SEND_LOCK_TTL_SECONDS: 900,

  /** Redis value for successful lock acquisition */
  LOCK_VALUE: '1',
} as const;

export interface IdempotencyResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Whether this was the first time (newly acquired) */
  isFirst: boolean;

  /** Optional error message */
  error?: string;
}

@Injectable()
export class MessageRequestIdempotencyService {
  private readonly logger: Logger;

  constructor(
    @Inject(APP_LOGGER) private readonly baseLogger: Logger,
    @Inject(SLACK_REQUEST_DI_TOKENS.IO_REDIS) private readonly redis: Redis,
  ) {
    this.logger = componentLogger(
      baseLogger,
      'MessageRequestIdempotencyService',
    );
  }

  /**
   * Attempt to acquire dispatch-once lock for job enqueuing
   *
   * @param tenant - Tenant identifier
   * @param messageRequestId - MessageRequest UUID
   * @returns IdempotencyResult indicating if this is first dispatch
   */
  async acquireDispatchLock(
    tenant: string,
    messageRequestId: string,
  ): Promise<IdempotencyResult> {
    const key = REDIS_KEYS.DISPATCH_ONCE(tenant, messageRequestId);

    try {
      // SETNX: Set if Not eXists (atomic operation)
      const result = await this.redis.setnx(key, LOCK_CONFIG.LOCK_VALUE);

      const success = result === 1;
      const isFirst = success; // Only first caller gets result === 1

      Log.debug(
        this.logger,
        `Dispatch lock attempt for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          success,
          isFirst,
        },
      );

      return {
        success: true, // Operation succeeded (even if lock not acquired)
        isFirst,
      };
    } catch (error) {
      Log.error(
        this.logger,
        `Failed to acquire dispatch lock for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      return {
        success: false,
        isFirst: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Attempt to acquire send-lock for message processing
   *
   * @param tenant - Tenant identifier
   * @param messageRequestId - MessageRequest UUID
   * @param ttlSeconds - Lock TTL (defaults to 15 minutes)
   * @returns IdempotencyResult indicating if lock was acquired
   */
  async acquireSendLock(
    tenant: string,
    messageRequestId: string,
    ttlSeconds: number = LOCK_CONFIG.SEND_LOCK_TTL_SECONDS,
  ): Promise<IdempotencyResult> {
    const key = REDIS_KEYS.SEND_LOCK(tenant, messageRequestId);

    try {
      // SETNX with TTL (atomic operation)
      const result = await this.redis.set(
        key,
        LOCK_CONFIG.LOCK_VALUE,
        'EX',
        ttlSeconds,
        'NX', // Only set if key doesn't exist
      );

      const success = result === 'OK';
      const isFirst = success; // Only first caller gets 'OK'

      Log.debug(
        this.logger,
        `Send lock attempt for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          ttlSeconds,
          success,
          isFirst,
        },
      );

      return {
        success: true, // Operation succeeded (even if lock not acquired)
        isFirst,
      };
    } catch (error) {
      Log.error(
        this.logger,
        `Failed to acquire send lock for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          ttlSeconds,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      return {
        success: false,
        isFirst: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Release send-lock (optional - TTL provides automatic cleanup)
   *
   * @param tenant - Tenant identifier
   * @param messageRequestId - MessageRequest UUID
   * @returns Whether the lock was released
   */
  async releaseSendLock(
    tenant: string,
    messageRequestId: string,
  ): Promise<boolean> {
    const key = REDIS_KEYS.SEND_LOCK(tenant, messageRequestId);

    try {
      const result = await this.redis.del(key);
      const released = result === 1;

      Log.debug(
        this.logger,
        `Send lock release for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          released,
        },
      );

      return released;
    } catch (error) {
      Log.error(
        this.logger,
        `Failed to release send lock for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      return false;
    }
  }

  /**
   * Check if dispatch lock exists (for debugging/monitoring)
   *
   * @param tenant - Tenant identifier
   * @param messageRequestId - MessageRequest UUID
   * @returns Whether dispatch lock exists
   */
  async hasDispatchLock(
    tenant: string,
    messageRequestId: string,
  ): Promise<boolean> {
    const key = REDIS_KEYS.DISPATCH_ONCE(tenant, messageRequestId);

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      Log.error(
        this.logger,
        `Failed to check dispatch lock for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return false;
    }
  }

  /**
   * Check if send lock exists (for debugging/monitoring)
   *
   * @param tenant - Tenant identifier
   * @param messageRequestId - MessageRequest UUID
   * @returns Whether send lock exists
   */
  async hasSendLock(
    tenant: string,
    messageRequestId: string,
  ): Promise<boolean> {
    const key = REDIS_KEYS.SEND_LOCK(tenant, messageRequestId);

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      Log.error(
        this.logger,
        `Failed to check send lock for MessageRequest ${messageRequestId}`,
        {
          tenant,
          messageRequestId,
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return false;
    }
  }
}
