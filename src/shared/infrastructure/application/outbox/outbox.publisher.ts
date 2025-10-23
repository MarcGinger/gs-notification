import { Injectable, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisOutboxRepository, StandardJobMetadata } from '../../outbox';
import { APP_LOGGER, Log, Logger } from '../../../logging';
import {
  NOTIFICATION_QUEUE,
  PROJECTION_QUEUE,
} from '../../../constants/injection-tokens';

/**
 * Outbox publisher that moves events from outbox to BullMQ queues
 * Implements the outbox pattern for reliable event publishing
 */
@Injectable()
export class OutboxPublisher {
  // logger is injected from APP_LOGGER (pino)

  constructor(
    @Inject(APP_LOGGER) private readonly logger: Logger,
    private readonly outbox: RedisOutboxRepository,
    @Inject(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @Inject(PROJECTION_QUEUE)
    private readonly projectionQueue: Queue,
  ) {}

  /**
   * Publish a batch of outbox records to appropriate queues
   */
  async publishBatch(
    limit = 100,
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    try {
      const items = await this.outbox.nextBatch(limit);

      if (items.length === 0) {
        return { processed: 0, failed: 0 };
      }

      Log.debug(this.logger, 'outbox.publishBatch.start', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'publishBatch',
        count: items.length,
      });

      const publishedIds: string[] = [];

      for (const item of items) {
        try {
          // Create job metadata
          const jobMetadata: StandardJobMetadata = {
            correlationId: item.metadata?.correlationId || item.eventId,
            causationId: item.metadata?.causationId,
            source: item.metadata?.source || 'outbox-publisher',
            timestamp: new Date().toISOString(),
            user: item.metadata?.user,
            businessContext: {
              eventType: item.type,
              eventId: item.eventId,

              originalMetadata: item.metadata,
            },
          };

          // Route to appropriate queue based on event type
          const queue = this.selectQueue(item.type);

          await queue.add(
            item.type,
            {
              eventId: item.eventId,
              type: item.type,

              payload: item.payload,
              metadata: jobMetadata,

              originalMetadata: item.metadata,
            },
            {
              jobId: item.eventId, // Ensures idempotency
              removeOnComplete: 100,
              removeOnFail: 50,
              attempts: 3,
              delay: 0,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          );

          publishedIds.push(item.id);
          processed++;

          Log.debug(this.logger, 'outbox.item.published', {
            service: 'shared',
            component: 'OutboxPublisher',
            method: 'publishBatch',
            eventId: item.eventId,
            eventType: item.type,
            queue: queue.name,
          });
        } catch (error) {
          failed++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          await this.outbox.markFailed(item.id, errorMessage);

          const e = error as Error;
          Log.error(this.logger, 'outbox.item.failed', {
            service: 'shared',
            component: 'OutboxPublisher',
            method: 'publishBatch',
            itemId: item.id,
            eventId: item.eventId,
            eventType: item.type,
            error: errorMessage,
            stack: e.stack,
          });
        }
      }

      // Mark successfully published items
      if (publishedIds.length > 0) {
        await this.outbox.markPublished(publishedIds);
      }

      Log.info(this.logger, 'outbox.publishBatch.complete', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'publishBatch',
        processed,
        failed,
        total: items.length,
      });

      return { processed, failed };
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'outbox.publishBatch.error', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'publishBatch',
        limit,
        error: e.message,
        stack: e.stack,
      });
      return { processed, failed };
    }
  }

  /**
   * Select appropriate queue based on event type
   */
  private selectQueue(eventType: string): Queue {
    // Route notification events to notification queue
    if (
      eventType.includes('notification') ||
      eventType.includes('email') ||
      eventType.includes('sms')
    ) {
      return this.notificationQueue;
    }

    // Route projection events to projection queue
    if (eventType.includes('projection') || eventType.includes('read-model')) {
      return this.projectionQueue;
    }

    // Default to notification queue for domain events
    return this.notificationQueue;
  }

  /**
   * Retry failed outbox records
   */
  async retryFailed(maxAttempts = 5): Promise<{ retried: number }> {
    try {
      const retryableItems = await this.outbox.retryFailed(maxAttempts);

      Log.info(this.logger, 'outbox.retryFailed.found', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'retryFailed',
        count: retryableItems.length,
      });

      return { retried: retryableItems.length };
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'outbox.retryFailed.error', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'retryFailed',
        maxAttempts,
        error: e.message,
        stack: e.stack,
      });
      return { retried: 0 };
    }
  }

  /**
   * Get outbox statistics
   */
  async getStats(): Promise<{
    pending: number;
    published: number;
    failed: number;
  }> {
    try {
      return await this.outbox.getStats();
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'outbox.getStats.error', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'getStats',
        error: e.message,
        stack: e.stack,
      });
      return { pending: 0, published: 0, failed: 0 };
    }
  }

  /**
   * Clean up old outbox records
   */
  async cleanup(olderThanDays = 7): Promise<{ deleted: number }> {
    try {
      const deleted = await this.outbox.cleanup(olderThanDays);

      Log.info(this.logger, 'outbox.cleanup.complete', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'cleanup',
        deleted,
        olderThanDays,
      });

      return { deleted };
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'outbox.cleanup.error', {
        service: 'shared',
        component: 'OutboxPublisher',
        method: 'cleanup',
        olderThanDays,
        error: e.message,
        stack: e.stack,
      });
      return { deleted: 0 };
    }
  }
}
