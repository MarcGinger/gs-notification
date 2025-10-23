import {
  KurrentDBClient,
  jsonEvent,
  START,
  NO_STREAM,
  ANY,
  WrongExpectedVersionError,
  ReadStreamOptions,
  BACKWARDS,
  FORWARDS,
  ReadAllOptions,
  PersistentSubscriptionToStreamSettings,
} from '@kurrent/kurrentdb-client';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigManager } from '../../config';

import { EventEnvelope } from '../../domain/events';
import { APP_LOGGER, Log, componentLogger, Logger } from '../../logging';
import {
  EVENTSTORE_ESDB_CONNECTION_STRING,
  ESDB_CONNECTION_STRING,
  ESDB_ENDPOINT,
} from '../../constants/injection-tokens';

@Injectable()
export class EventStoreService {
  private readonly client: KurrentDBClient;
  private logger: Logger;

  constructor(
    private readonly configManager: ConfigManager,
    @Inject(APP_LOGGER) private readonly baseLogger: Logger,
  ) {
    // Get EventStore connection from centralized config
    const esdbConn = this.getEsdbConnectionString();
    this.client = KurrentDBClient.connectionString(esdbConn);

    // Component-scoped logger to avoid repeating static metadata
    this.logger = componentLogger(this.baseLogger, 'EventStoreService');

    Log.info(this.logger, 'EventStoreService.initialized', {
      method: 'constructor',
      esdbEndpoint: esdbConn.replace(/\/\/.*@/, '//***@'), // Hide credentials if any
    });
  }

  /**
   * Get EventStore connection string from centralized config
   */
  private getEsdbConnectionString(): string {
    return (
      this.configManager.get(EVENTSTORE_ESDB_CONNECTION_STRING) ??
      this.configManager.get(ESDB_CONNECTION_STRING) ??
      this.configManager.get(ESDB_ENDPOINT) ??
      'esdb://localhost:2113?tls=false'
    );
  }

  /**
   * Get the underlying EventStoreDBClient for direct access
   * Used by infrastructure providers that need the raw client
   */
  getClient(): KurrentDBClient {
    return this.client;
  }

  /**
   * Append events with optimistic concurrency + structured logging + jittered backoff
   */
  async append<T>(
    streamId: string,
    events: Array<EventEnvelope<T>>,
    expectedRevision: bigint | typeof NO_STREAM | typeof ANY,
    retries = 2,
  ) {
    const toJson = (e: EventEnvelope<T>) =>
      jsonEvent({
        type: e.type,
        data: e.data as any,
        metadata: e.metadata,
      });

    const correlationId = events[0]?.metadata?.correlationId;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Log the events being sent to EventStoreDB for debugging
        Log.debug(this.logger, 'append.attempt', {
          method: 'append',
          streamId,
          attempt,
          eventCount: events.length,
          expectedRevision:
            typeof expectedRevision === 'bigint'
              ? expectedRevision.toString()
              : String(expectedRevision),
          correlationId,
        });

        const result = await this.client.appendToStream(
          streamId,
          events.map(toJson),
          { streamState: expectedRevision },
        );

        Log.debug(this.logger, 'append.success', {
          method: 'append',
          streamId,
          nextExpectedRevision: result.nextExpectedRevision?.toString(),
          correlationId,
          eventCount: events.length,
        });

        return result;
      } catch (err) {
        if (err instanceof WrongExpectedVersionError && attempt < retries) {
          Log.warn(this.logger, 'append.retry.wrongExpectedVersion', {
            method: 'append',
            streamId,
            attempt,
            retries,
            correlationId,
          });

          // Jittered exponential backoff to reduce contention
          const baseDelay = 50 * Math.pow(2, attempt);
          const jitter = Math.random() * 0.3; // +/- 30% jitter
          const delay = Math.min(baseDelay * (1 + jitter), 500);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        const e = err as Error;
        Log.error(this.logger, 'append.failed', {
          method: 'append',
          streamId,
          correlationId,
          attempt,
          error: e.message,
          stack: e.stack,
        });
        throw err;
      }
    }
  }

  /**
   * Read a stream forward (default direction)
   */
  readStream(streamId: string, options?: ReadStreamOptions) {
    return this.client.readStream(streamId, {
      direction: FORWARDS,
      ...options,
    });
  }

  /**
   * Read stream backwards (tail-first) using typed constant
   */
  readStreamBackwards(streamId: string, options?: ReadStreamOptions) {
    return this.client.readStream(streamId, {
      direction: BACKWARDS,
      ...options,
    });
  }

  /**
   * Read $all stream (lightweight; useful for health/checkpoint)
   */
  readAll(options?: ReadAllOptions) {
    return this.client.readAll({ direction: FORWARDS, ...options });
  }

  /**
   * Subscribe to $all with filters (used by projection runners)
   */
  subscribeToAll(options: Parameters<KurrentDBClient['subscribeToAll']>[0]) {
    return this.client.subscribeToAll(options);
  }

  /**
   * Get stream metadata (typed pass-through)
   */
  async getStreamMetadata(streamId: string) {
    return this.client.getStreamMetadata(streamId);
  }

  /**
   * Set stream metadata (typed pass-through)
   */
  async setStreamMetadata(streamId: string, metadata: Record<string, any>) {
    return this.client.setStreamMetadata(streamId, metadata);
  }

  /**
   * Persistent subscription utilities with proper typing
   */
  persistent = {
    create: (
      stream: string,
      group: string,
      settings?: Partial<PersistentSubscriptionToStreamSettings>,
    ) =>
      this.client.createPersistentSubscriptionToStream(
        stream,
        group,
        settings as PersistentSubscriptionToStreamSettings,
      ),

    connect: (stream: string, group: string) =>
      this.client.subscribeToPersistentSubscriptionToStream(stream, group),

    update: (
      stream: string,
      group: string,
      settings: Partial<PersistentSubscriptionToStreamSettings>,
    ) =>
      this.client.updatePersistentSubscriptionToStream(
        stream,
        group,
        settings as PersistentSubscriptionToStreamSettings,
      ),

    delete: (stream: string, group: string) =>
      this.client.deletePersistentSubscriptionToStream(stream, group),
  };

  /**
   * Health check - avoids $stats (may be disabled/privileged)
   * Uses lightweight readAll instead
   */
  async ping(): Promise<boolean> {
    try {
      const iter = this.readAll({ fromPosition: START, maxCount: 1 });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iter) break;

      Log.debug(this.logger, 'eventstore.ping.success', {
        method: 'ping',
      });
      return true;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'eventstore.ping.failed', {
        method: 'ping',
        error: e.message,
        stack: e.stack,
      });
      return false;
    }
  }

  /**
   * Close the EventStore connection gracefully
   */
  async close(): Promise<void> {
    await this.client.dispose();
    Log.info(this.logger, 'EventStoreService.disposed', {
      method: 'close',
    });
  }
}
