/**
 * Redis-based Idempotency Interfaces
 *
 * Generic interfaces for implementing dispatch-once and execution-lock patterns
 * across different contexts (notifications, payments, etc.)
 */

/**
 * Configuration for Redis idempotency patterns
 */
export interface IdempotencyConfig {
  /** Namespace for the context (e.g., 'notification.slack', 'payment.stripe') */
  namespace: string;

  /** Version for key schema compatibility */
  version: string;

  /** Entity type being processed (e.g., 'message-request', 'transaction') */
  entityType: string;

  /** TTL for dispatch-once locks (optional, default: no expiry) */
  dispatchTtl?: number;

  /** TTL for execution locks in seconds (default: 900 = 15 minutes) */
  executionTtl?: number;
}

/**
 * Result of idempotency operation
 */
export interface IdempotencyResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Whether this was the first time (newly acquired) */
  isFirst: boolean;

  /** Optional error message */
  error?: string;
}

/**
 * Interface for Redis idempotency operations
 */
export interface IRedisIdempotencyService {
  /**
   * Attempt to acquire dispatch-once lock for job enqueuing
   * Prevents duplicate job creation from projectors
   */
  acquireDispatchLock(
    tenant: string,
    entityId: string,
  ): Promise<IdempotencyResult>;

  /**
   * Attempt to acquire execution lock for processing
   * Prevents concurrent execution by workers
   */
  acquireExecutionLock(
    tenant: string,
    entityId: string,
  ): Promise<IdempotencyResult>;

  /**
   * Release execution lock (optional cleanup)
   * Lock will auto-expire based on TTL
   */
  releaseExecutionLock(
    tenant: string,
    entityId: string,
  ): Promise<IdempotencyResult>;

  /**
   * Check if dispatch lock exists
   */
  hasDispatchLock(tenant: string, entityId: string): Promise<boolean>;

  /**
   * Check if execution lock exists
   */
  hasExecutionLock(tenant: string, entityId: string): Promise<boolean>;
}
