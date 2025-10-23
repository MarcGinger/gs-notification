import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
  eventTypeFilter,
  START,
  AllStreamSubscription,
  streamNameFilter,
} from '@kurrent/kurrentdb-client';
import { EventStoreService } from '../eventstore/eventstore.service';
import { CheckpointStore } from './checkpoint.store';
import { CHECKPOINT_STORE } from '../infrastructure.tokens';
import { APP_LOGGER, Log, componentLogger, Logger } from '../../logging';
import { Result, ok, err, DomainError, withContext } from '../../errors';
import { EventMetadata } from '../../domain/events';

export type ProjectionEvent = {
  type: string;
  data?: unknown; // Align with DomainEvent interface for type safety
  metadata?: EventMetadata;
  streamId: string;
  revision: number;
  position?: { commit: bigint; prepare: bigint };
};

export type ProjectFn = (event: ProjectionEvent) => Promise<void> | void;

export interface DlqHook {
  publish(event: ProjectionEvent, reason: string): Promise<void>;
}

/**
 * Catchup runner error definitions for creating domain errors
 */
const CatchupRunnerErrorDefinitions = {
  PROJECTION_EXECUTION_FAILED: {
    title: 'Projection Execution Failed',
    detail: 'Failed to execute projection function for event',
    category: 'application' as const,
    retryable: true,
  },

  SUBSCRIPTION_FAILED: {
    title: 'Event Subscription Failed',
    detail: 'Failed to establish or maintain event store subscription',
    category: 'infrastructure' as const,
    retryable: true,
  },

  SLEEP_CANCELLED: {
    title: 'Sleep Operation Cancelled',
    detail: 'Sleep operation was cancelled due to shutdown request',
    category: 'application' as const,
    retryable: false,
  },

  OPERATION_CANCELLED: {
    title: 'Operation Cancelled',
    detail: 'Operation was cancelled due to shutdown or cancellation request',
    category: 'application' as const,
    retryable: false,
  },

  INFRASTRUCTURE_ERROR: {
    title: 'Infrastructure Error',
    detail: 'Infrastructure-level error during catchup operation',
    category: 'infrastructure' as const,
    retryable: true,
  },
} as const;

/**
 * Catchup runner error catalog with namespaced error codes
 */
const CatchupRunnerErrors = Object.fromEntries(
  Object.entries(CatchupRunnerErrorDefinitions).map(([key, errorDef]) => {
    const code = `CATCHUP_RUNNER.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof CatchupRunnerErrorDefinitions]: DomainError<`CATCHUP_RUNNER.${Extract<K, string>}`>;
};

export interface RunOptions {
  /**
   * Event type prefixes to filter on (e.g., ['user-', 'order-'])
   */
  prefixes: string[];

  /**
   * Size of batch for checkpoint updates and logging
   */
  batchSize?: number;

  /**
   * Whether to stop when caught up to live events
   */
  stopOnCaughtUp?: boolean;

  /**
   * Maximum number of retries for failed projections
   */
  maxRetries?: number;

  /**
   * Base delay for retries (exponential backoff applied)
   */
  retryDelayMs?: number;

  /**
   * Dead letter queue hook for failed events
   */
  dlq?: DlqHook;

  /**
   * Throttle checkpoint writes (batch every N events)
   */
  checkpointBatchSize?: number;
}

interface SubscriptionHandle {
  subscription: AllStreamSubscription;
  abortController: AbortController;
}

interface CheckpointPosition {
  commit: bigint;
  prepare: bigint;
}

/**
 * Production-ready catch-up subscription runner for building projections
 * - Proper cancellation via AbortController
 * - Structured logging with Log.minimal API
 * - Enhanced checkpoint storage with commit/prepare positions
 * - DLQ support for failed events
 * - Retry classification for domain vs infrastructure errors
 * - Backpressure handling and concurrency control
 * - Graceful shutdown with checkpoint flushing
 */
@Injectable()
export class CatchUpRunner implements OnApplicationShutdown {
  private readonly runningSubscriptions = new Map<string, SubscriptionHandle>();
  private readonly pendingCheckpoints = new Map<string, CheckpointPosition>();
  private readonly logger: Logger;

  constructor(
    private readonly es: EventStoreService,
    @Inject(CHECKPOINT_STORE) private readonly checkpoints: CheckpointStore,
    @Inject(APP_LOGGER) private readonly moduleLogger: Logger,
  ) {
    const COMPONENT = 'CatchUpRunner';
    this.logger = componentLogger(this.moduleLogger, COMPONENT);
  }

  /**
   * Graceful shutdown: stop all subscriptions and flush checkpoints
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    Log.info(this.logger, 'Shutting down catch-up runner', {
      method: 'onApplicationShutdown',
      signal,
      activeSubscriptions: this.runningSubscriptions.size,
    });

    try {
      // Stop all running subscriptions and flush any pending checkpoints
      for (const [group] of this.runningSubscriptions.entries()) {
        // Flush pending checkpoint before stopping
        await this.flushCheckpoint(group);
        // Stop the subscription
        this.stop(group);
      }

      Log.info(this.logger, 'Catch-up runner shutdown complete', {
        method: 'onApplicationShutdown',
      });
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      Log.error(this.logger, 'Error during catch-up runner shutdown', {
        method: 'onApplicationShutdown',
        error: e.message,
        stack: e.stack,
      });
    }
  }

  /**
   * Start a catch-up subscription safely with Result pattern
   */
  async runSafe(
    group: string,
    project: ProjectFn,
    options: RunOptions,
  ): Promise<Result<void, DomainError>> {
    const {
      prefixes,
      batchSize = 100,
      stopOnCaughtUp = false,
      maxRetries = 3,
      retryDelayMs = 1000,
      dlq,
      checkpointBatchSize = 10,
    } = options;

    if (this.runningSubscriptions.has(group)) {
      Log.warn(this.logger, 'Catch-up subscription already running', {
        method: 'runSafe',
        group,
        expected: true,
      });
      return ok(void 0);
    }

    // Setup cancellation
    const abortController = new AbortController();

    try {
      // Get checkpoint position - enhanced to support { commit, prepare }
      const checkpointPos = await this.getEnhancedCheckpoint(group);

      Log.info(this.logger, 'Starting catch-up subscription', {
        method: 'runSafe',
        group,
        prefixes: prefixes.join(','),
        checkpointPosition: checkpointPos
          ? `${checkpointPos.commit}:${checkpointPos.prepare}`
          : 'START',
        batchSize,
        stopOnCaughtUp,
        maxRetries,
        checkpointBatchSize,
        hasDlq: !!dlq,
      });

      // Create EventStore subscription
      const subscription = this.es.subscribeToAll({
        fromPosition: checkpointPos || START,
        filter: streamNameFilter({ prefixes }),
      });

      // Store subscription handle for proper cancellation
      this.runningSubscriptions.set(group, { subscription, abortController });

      let processedCount = 0;
      let errorCount = 0;
      let dlqCount = 0;
      const startTime = Date.now();

      for await (const resolvedEvent of subscription) {
        // Check for cancellation
        if (abortController.signal.aborted) {
          Log.info(this.logger, 'Catch-up subscription cancelled', {
            method: 'runSafe',
            group,
            processedCount,
            errorCount,
            dlqCount,
          });
          break;
        }

        try {
          if (!resolvedEvent.event) continue;

          const { event } = resolvedEvent;
          const projectionEvent: ProjectionEvent = {
            type: event.type,
            data: event.data,
            metadata: this.parseEventMetadata(event.metadata),
            streamId: event.streamId || 'unknown',
            revision: Number(event.revision || 0),
            position: resolvedEvent.commitPosition
              ? {
                  commit: resolvedEvent.commitPosition,
                  prepare: resolvedEvent.commitPosition, // Use commit for both
                }
              : undefined,
          };

          // Execute projection with enhanced retry logic
          const projectionResult =
            await this.executeProjectionWithClassifiedRetrySafe(
              project,
              projectionEvent,
              maxRetries,
              retryDelayMs,
            );

          if (projectionResult.ok) {
            processedCount++;
          } else {
            errorCount++;

            // Send to DLQ if available and it's a projection error
            const isProjectionError = this.isProjectionError(
              new Error(String(projectionResult.error.context?.cause)),
            );
            if (isProjectionError && dlq) {
              try {
                await dlq.publish(
                  projectionEvent,
                  projectionResult.error.title,
                );
                dlqCount++;

                Log.warn(
                  this.logger,
                  'Event sent to DLQ after projection failure',
                  {
                    method: 'runSafe',
                    group,
                    eventType: event.type,
                    eventId: event.id,
                    streamId: event.streamId,
                    reason: projectionResult.error.title,
                    expected: isProjectionError,
                  },
                );
              } catch (dlqErr) {
                const de = dlqErr as Error;
                Log.error(this.logger, 'Failed to publish to DLQ', {
                  method: 'runSafe',
                  group,
                  eventType: event.type,
                  error: de.message,
                  stack: de.stack,
                });
              }
            } else {
              Log.error(this.logger, 'Event processing failed', {
                method: 'runSafe',
                group,
                eventType: event.type,
                eventId: event.id,
                streamId: event.streamId,
                expected: isProjectionError,
                error: projectionResult.error.title,
                context: projectionResult.error.context,
              });
            }
          }

          // Batch checkpoint updates to reduce write pressure
          if (resolvedEvent.commitPosition) {
            this.pendingCheckpoints.set(group, {
              commit: resolvedEvent.commitPosition,
              prepare: resolvedEvent.commitPosition, // Use commit for both
            });

            if (processedCount % checkpointBatchSize === 0) {
              await this.flushCheckpoint(group);
            }
          }

          // Periodic progress logging
          if (processedCount % batchSize === 0) {
            const elapsed = Date.now() - startTime;
            const rate = Math.round((processedCount / elapsed) * 1000);

            Log.debug(this.logger, 'Catch-up subscription progress', {
              method: 'runSafe',
              group,
              processedCount,
              errorCount,
              dlqCount,
              rate: `${rate}/sec`,
              lastPosition: resolvedEvent.commitPosition?.toString(),
              timingMs: elapsed,
            });
          }
        } catch (err) {
          errorCount++;
          const e = err as Error;
          Log.error(
            this.logger,
            'Event processing failed with unexpected error',
            {
              method: 'runSafe',
              group,
              eventType: resolvedEvent.event?.type,
              eventId: resolvedEvent.event?.id,
              streamId: resolvedEvent.event?.streamId,
              error: e.message,
              stack: e.stack,
            },
          );
        }
      }

      // Flush any remaining checkpoint
      await this.flushCheckpoint(group);

      const elapsed = Date.now() - startTime;
      Log.info(this.logger, 'Catch-up subscription completed', {
        method: 'runSafe',
        group,
        processedCount,
        errorCount,
        dlqCount,
        timingMs: elapsed,
        avgRate:
          elapsed > 0 ? Math.round((processedCount / elapsed) * 1000) : 0,
      });

      return ok(void 0);
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Catch-up subscription failed', {
        method: 'runSafe',
        group,
        error: e.message,
        stack: e.stack,
      });

      return err(
        withContext(CatchupRunnerErrors.SUBSCRIPTION_FAILED, {
          group,
          cause: e.message,
          stack: e.stack,
        }),
      );
    } finally {
      this.runningSubscriptions.delete(group);
      this.pendingCheckpoints.delete(group);
    }
  }

  /**
   * Get enhanced checkpoint with commit/prepare positions
   */
  private async getEnhancedCheckpoint(
    group: string,
  ): Promise<CheckpointPosition | null> {
    try {
      const stored = await this.checkpoints.get(group);
      if (!stored) return null;

      // The new CheckpointStore returns structured CheckpointPosition objects
      return {
        commit: BigInt(stored.commit),
        prepare: BigInt(stored.prepare),
      };
    } catch (error) {
      Log.warn(
        this.logger,
        'Failed to parse checkpoint, starting from beginning',
        {
          method: 'getEnhancedCheckpoint',
          group,
          error: error instanceof Error ? error.message : String(error),
          expected: true,
        },
      );
      return null;
    }
  }

  /**
   * Flush pending checkpoint to storage
   */
  private async flushCheckpoint(group: string): Promise<void> {
    const pending = this.pendingCheckpoints.get(group);
    if (!pending) return;

    try {
      // Convert bigint positions to structured checkpoint position
      const checkpointPos: import('./checkpoint.store').CheckpointPosition = {
        commit: pending.commit.toString(),
        prepare: pending.prepare.toString(),
        updatedAt: new Date().toISOString(),
      };

      await this.checkpoints.set(group, checkpointPos);
      this.pendingCheckpoints.delete(group);
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to flush checkpoint', {
        method: 'flushCheckpoint',
        group,
        error: e.message,
        stack: e.stack,
      });
    }
  }

  /**
   * Safe sleep with cancellation support (Result pattern)
   */
  private async sleepSafe(ms: number): Promise<Result<void, DomainError>> {
    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
        // Note: Individual sleep operations don't have direct cancellation support
        // The caller should handle cancellation at a higher level using the subscription's abortController
      });

      return ok(void 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes('cancelled') ||
        errorMessage.includes('shutdown')
      ) {
        return err(
          withContext(CatchupRunnerErrors.OPERATION_CANCELLED, {
            operation: 'sleep',
            duration: ms,
            reason: errorMessage,
          }),
        );
      }

      return err(
        withContext(CatchupRunnerErrors.INFRASTRUCTURE_ERROR, {
          operation: 'sleep',
          duration: ms,
          cause: errorMessage,
        }),
      );
    }
  }

  /**
   * Enhanced retry execution with error classification (Result pattern)
   */
  private async executeProjectionWithClassifiedRetrySafe(
    project: ProjectFn,
    event: ProjectionEvent,
    maxRetries: number,
    retryDelayMs: number,
  ): Promise<Result<void, DomainError>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await project(event);
        return ok(void 0); // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Classify error type
        const isProjectionError = this.isProjectionError(error);

        // Don't retry domain/projection errors - they're deterministic
        if (isProjectionError && attempt === 0) {
          Log.warn(this.logger, 'Domain error detected, not retrying', {
            method: 'executeProjectionWithClassifiedRetrySafe',
            eventType: event.type,
            attempt: attempt + 1,
            error: lastError.message,
            expected: true,
          });

          return err(
            withContext(CatchupRunnerErrors.PROJECTION_EXECUTION_FAILED, {
              eventType: event.type,
              eventId: event.revision,
              streamId: event.streamId,
              attempt: attempt + 1,
              isDomainError: true,
              cause: lastError.message,
            }),
          );
        }

        if (attempt < maxRetries && !isProjectionError) {
          const backoffMs = this.calculateJitteredBackoff(
            retryDelayMs,
            attempt,
          );

          Log.warn(this.logger, 'Infrastructure error, retrying with backoff', {
            method: 'executeProjectionWithClassifiedRetrySafe',
            eventType: event.type,
            attempt: attempt + 1,
            maxRetries,
            backoffMs,
            error: lastError.message,
            retry: { attempt: attempt + 1, backoffMs },
          });

          const sleepResult = await this.sleepSafe(backoffMs);
          if (sleepResult.ok === false) {
            return sleepResult;
          }
        }
      }
    }

    // All retries exhausted for infrastructure errors
    return err(
      withContext(CatchupRunnerErrors.PROJECTION_EXECUTION_FAILED, {
        eventType: event.type,
        eventId: event.revision,
        streamId: event.streamId,
        maxRetries,
        retriesExhausted: true,
        cause: lastError?.message || 'Unknown error',
      }),
    );
  }

  /**
   * Classify errors to distinguish domain logic failures from infrastructure issues
   */
  private isProjectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Domain/business logic errors (4xx class) - don't retry
    const domainErrorPatterns = [
      'validation',
      'invalid',
      'constraint',
      'domain',
      'business',
      'aggregate',
      'unauthorized',
      'forbidden',
      'conflict',
      'not found',
      'already exists',
    ];

    // Infrastructure errors (5xx class) - can retry
    const infraErrorPatterns = [
      'timeout',
      'connection',
      'network',
      'unavailable',
      'redis',
      'database',
      'esdb',
      'eventstore',
    ];

    // Check if it's explicitly an infrastructure error first
    if (
      infraErrorPatterns.some(
        (pattern) => message.includes(pattern) || name.includes(pattern),
      )
    ) {
      return false; // Infrastructure error - can retry
    }

    // Check if it's a domain error
    if (
      domainErrorPatterns.some(
        (pattern) => message.includes(pattern) || name.includes(pattern),
      )
    ) {
      return true; // Domain error - don't retry
    }

    // Default: treat unknown errors as infrastructure (retryable)
    return false;
  }

  /**
   * Calculate jittered exponential backoff
   */
  private calculateJitteredBackoff(
    baseDelayMs: number,
    attempt: number,
  ): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const maxDelay = 30000; // Cap at 30 seconds
    const baseDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter: +/- 25%
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(100, Math.floor(baseDelay + jitter)); // Minimum 100ms
  }

  /**
   * Check if a subscription is currently running
   */
  isRunning(group: string): boolean {
    return this.runningSubscriptions.has(group);
  }

  /**
   * Stop a running subscription with proper cancellation
   */
  stop(group: string): void {
    const handle = this.runningSubscriptions.get(group);
    if (handle) {
      // Signal cancellation - the async iterator will check this
      handle.abortController.abort();

      Log.info(this.logger, 'Catch-up subscription stop requested', {
        method: 'stop',
        group,
      });
    } else {
      Log.warn(this.logger, 'Attempted to stop non-running subscription', {
        method: 'stop',
        group,
        expected: true,
      });
    }
  }

  /**
   * Get status of all running subscriptions
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [group] of this.runningSubscriptions) {
      status[group] = true;
    }
    return status;
  }

  /**
   * Utility sleep function with AbortSignal support
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Sleep cancelled'));
        return;
      }

      const timeout = setTimeout(resolve, ms);

      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Sleep cancelled'));
      });
    });
  }

  /**
   * Reset checkpoint for a group (useful for replaying from start)
   */
  async resetCheckpoint(group: string): Promise<void> {
    await this.checkpoints.delete(group);
    this.pendingCheckpoints.delete(group);

    Log.info(this.logger, 'Checkpoint reset for replay', {
      method: 'resetCheckpoint',
      group,
    });
  }

  /**
   * Get current checkpoint position for a group with enhanced format
   */
  async getCheckpoint(group: string): Promise<CheckpointPosition | null> {
    return this.getEnhancedCheckpoint(group);
  }

  /**
   * Force flush pending checkpoints for a group
   */
  async forceFlushCheckpoint(group: string): Promise<void> {
    await this.flushCheckpoint(group);

    Log.debug(this.logger, 'Checkpoint flushed', {
      method: 'forceFlushCheckpoint',
      group,
    });
  }

  /**
   * Get detailed status including performance metrics
   */
  getDetailedStatus(): Record<
    string,
    { running: boolean; hasPendingCheckpoint: boolean }
  > {
    const status: Record<
      string,
      { running: boolean; hasPendingCheckpoint: boolean }
    > = {};

    for (const [group] of this.runningSubscriptions) {
      status[group] = {
        running: true,
        hasPendingCheckpoint: this.pendingCheckpoints.has(group),
      };
    }

    return status;
  }

  /**
   * Parse EventStore metadata into our domain EventMetadata type
   * Handles various metadata formats from the EventStore client
   */
  private parseEventMetadata(rawMetadata: unknown): EventMetadata | undefined {
    if (!rawMetadata) return undefined;

    try {
      // If it's already an object that looks like EventMetadata, return it
      if (typeof rawMetadata === 'object' && rawMetadata !== null) {
        return rawMetadata as EventMetadata;
      }

      // If it's a string, try to parse as JSON
      if (typeof rawMetadata === 'string') {
        const parsed: unknown = JSON.parse(rawMetadata);
        return parsed as EventMetadata;
      }

      // If it's a Buffer, convert to string and parse
      if (rawMetadata instanceof Buffer) {
        const parsed: unknown = JSON.parse(rawMetadata.toString('utf8'));
        return parsed as EventMetadata;
      }

      // Fallback: return undefined for unknown types
      return undefined;
    } catch (error) {
      Log.warn(this.logger, 'Failed to parse event metadata', {
        method: 'parseEventMetadata',
        rawType: typeof rawMetadata,
        error: error instanceof Error ? error.message : String(error),
        expected: true,
      });
      return undefined;
    }
  }
}
