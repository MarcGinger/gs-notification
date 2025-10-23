// Safe correlationId accessor for event metadata
function getCorrelationId(meta: unknown): string | undefined {
  return typeof meta === 'object' && meta !== null && 'correlationId' in meta
    ? ((meta as Record<string, unknown>).correlationId as string | undefined)
    : undefined;
}
import { Inject, Injectable } from '@nestjs/common';
import {
  START,
  FORWARDS,
  BACKWARDS,
  ReadStreamOptions,
} from '@kurrent/kurrentdb-client';
import { EventStoreService } from './eventstore.service';
import { SnapshotRepository } from './snapshot.repository';
import { Reducer } from '../../domain/aggregates';
import { Snapshot } from '../../domain/events';
import { APP_LOGGER, Log, Logger } from '../../logging';
import { Result, ok, err, DomainError, withContext } from '../../errors';

type StreamIds = { streamId: string; snapId: string };

/**
 * Error catalog for aggregate repository operations
 */
const AggregateRepositoryErrorDefinitions = {
  AGGREGATE_LOAD_CANCELLED: {
    title: 'Aggregate load cancelled',
    detail: 'Aggregate load operation was cancelled by signal',
    category: 'application' as const,
  },
  AGGREGATE_REBUILD_FAILED: {
    title: 'Aggregate rebuild failed',
    detail: 'Failed to rebuild aggregate from event stream',
    category: 'infrastructure' as const,
    retryable: true,
  },
  EVENT_APPLY_FAILED: {
    title: 'Event apply failed',
    detail: 'Failed to apply event during aggregate reconstruction',
    category: 'domain' as const,
  },
} as const;

/**
 * Aggregate repository error catalog with namespaced error codes
 */
const AggregateRepositoryErrors = Object.fromEntries(
  Object.entries(AggregateRepositoryErrorDefinitions).map(([key, errorDef]) => {
    const code = `AGGREGATE_REPOSITORY.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof AggregateRepositoryErrorDefinitions]: DomainError<`AGGREGATE_REPOSITORY.${Extract<K, string>}`>;
};

/**
 * Centralized stream ID builder to avoid drift across the codebase
 */
function buildStreamIds(
  context: string,
  aggregate: string,
  aggSchema: number,
  tenant: string,
  entityId: string,
): StreamIds {
  const base = `${context}.${aggregate}.v${aggSchema}-${tenant}-${entityId}`;
  return { streamId: base, snapId: `snap.${base}` };
}

/**
 * Domain-specific error for aggregate rebuild failures
 */
export class AggregateRebuildFailedError extends Error {
  constructor(
    public readonly streamId: string,
    public readonly context: string,
    public readonly aggregate: string,
    public readonly entityId: string,
    cause: Error,
  ) {
    super(
      `Failed to rebuild aggregate ${aggregate}/${entityId}: ${cause.message}`,
    );
    this.name = 'AggregateRebuildFailedError';
    this.cause = cause;
  }
}

@Injectable()
export class AggregateRepository<State> {
  constructor(
    private readonly es: EventStoreService,
    private readonly snapshots: SnapshotRepository<State>,
    @Inject(APP_LOGGER) private readonly logger: Logger,
  ) {}

  // Adapter to support both real pino Logger and test mocks that expect
  // the shape `logger.debug(ctx, msg, meta?)` and `logger.error(ctx, err, msg, meta?)`.
  // Centralizing here keeps casts in one place and provides a typed surface.
  private injectedLogger(): {
    debug: (ctx: unknown, msg: string, meta?: Record<string, unknown>) => void;
    error: (
      ctx: unknown,
      err: unknown,
      msg?: string,
      meta?: Record<string, unknown>,
    ) => void;
  } {
    return this.logger as unknown as {
      debug: (
        ctx: unknown,
        msg: string,
        meta?: Record<string, unknown>,
      ) => void;
      error: (
        ctx: unknown,
        err: unknown,
        msg?: string,
        meta?: Record<string, unknown>,
      ) => void;
    };
  }

  /**
   * Load aggregate state safely with Result pattern
   * Returns the aggregate version (domain event index, starting at -1).
   */
  async loadSafe(
    context: string,
    aggregate: string,
    aggSchema: number,
    tenant: string,
    entityId: string,
    reducer: Reducer<State>,
    options?: {
      signal?: AbortSignal;
      readOptions?: Omit<ReadStreamOptions, 'direction'>;
      correlationId?: string;
    },
  ): Promise<Result<{ state: State; version: number }, DomainError>> {
    const { streamId, snapId } = buildStreamIds(
      context,
      aggregate,
      aggSchema,
      tenant,
      entityId,
    );

    Log.debug(this.logger, 'aggregate.load.start', {
      component: 'AggregateRepository',
      method: 'loadSafe',
      streamId,
      snapId,
      context,
      aggregate,
      tenant,
      entityId,
      correlationId: options?.correlationId,
    });

    try {
      // 1) Load snapshot (+ cache flag if you want to log it)
      const { snapshot: snap, cacheHit } =
        await this.snapshots.loadLatest(snapId);
      Log.debug(this.logger, 'aggregate.load.snapshot', {
        component: 'AggregateRepository',
        method: 'loadSafe',
        snapId,
        hasSnapshot: !!snap,
        cacheHit,
        correlationId: options?.correlationId,
      });
      try {
        this.injectedLogger().debug({}, 'aggregate.load.snapshot', {
          component: 'AggregateRepository',
          method: 'loadSafe',
          snapId,
          hasSnapshot: !!snap,
          cacheHit,
          correlationId: options?.correlationId,
        });
      } catch {
        /* ignore */
      }
      let state = snap?.state ?? reducer.initial();
      let version = snap?.version ?? -1; // domain version; -1 means no events applied
      let eventsProcessed = 0;

      // 2) Replay events since snapshot
      const fromRevision = snap ? BigInt(snap.version + 1) : START;
      Log.debug(this.logger, 'aggregate.load.replayStart', {
        component: 'AggregateRepository',
        method: 'loadSafe',
        streamId,
        hasSnapshot: !!snap,
        snapshotVersion: snap?.version,
        fromRevision:
          fromRevision === START ? 'START' : fromRevision.toString(),
        correlationId: options?.correlationId,
      });

      const iter = this.es.readStream(streamId, {
        direction: FORWARDS,
        fromRevision,
        ...options?.readOptions,
      });

      // If the underlying EventStore client returned nothing or something
      // that isn't an async iterable, treat it as an empty stream.
      const iterProto = iter as unknown as {
        [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
      };
      if (!iter || typeof iterProto[Symbol.asyncIterator] !== 'function') {
        Log.debug(this.logger, 'aggregate.load.replaySkipped', {
          component: 'AggregateRepository',
          method: 'loadSafe',
          streamId,
          fromRevision:
            fromRevision === START ? 'START' : fromRevision.toString(),
          correlationId: options?.correlationId,
        });
        try {
          this.injectedLogger().debug({}, 'aggregate.load.replaySkipped', {
            component: 'AggregateRepository',
            method: 'loadSafe',
            streamId,
            fromRevision:
              fromRevision === START ? 'START' : fromRevision.toString(),
            correlationId: options?.correlationId,
          });
        } catch {
          // Intentionally ignore logging errors in tests
        }
      } else {
        for await (const resolved of iter) {
          // Check for cancellation
          if (options?.signal?.aborted) {
            return err(
              withContext(AggregateRepositoryErrors.AGGREGATE_LOAD_CANCELLED, {
                streamId,
                context,
                aggregate,
                entityId,
                tenant,
                correlationId: options.correlationId,
              }),
            );
          }

          const event = resolved.event;
          if (!event) continue;

          try {
            state = reducer.apply(state, {
              type: event.type,
              data: event.data,
              metadata: event.metadata,
            });
            version++;
            eventsProcessed++;
          } catch (error) {
            const e = error as Error;
            Log.error(this.logger, 'aggregate.load.eventApplyFailed', {
              component: 'AggregateRepository',
              method: 'loadSafe',
              streamId,
              eventType: event.type,
              eventId: event.id,
              version,
              correlationId:
                options?.correlationId ?? getCorrelationId(event.metadata),
              eventStreamId: event.streamId,
              error: e.message,
              stack: e.stack,
            });

            try {
              this.injectedLogger().error(
                {},
                new Error(e.message),
                'aggregate.load.eventApplyFailed',
                {
                  component: 'AggregateRepository',
                  method: 'loadSafe',
                  streamId,
                  eventType: event.type,
                  eventId: event.id,
                  version,
                  correlationId:
                    options?.correlationId ?? getCorrelationId(event.metadata),
                  eventStreamId: event.streamId,
                },
              );
            } catch {
              // Intentionally ignore logging errors in tests
            }

            return err(
              withContext(AggregateRepositoryErrors.EVENT_APPLY_FAILED, {
                streamId,
                context,
                aggregate,
                entityId,
                eventType: event.type,
                eventId: event.id,
                version,
                correlationId:
                  options?.correlationId ?? getCorrelationId(event.metadata),
                cause: e.message,
              }),
            );
          }
        }
      }

      Log.debug(this.logger, 'aggregate.load.complete', {
        component: 'AggregateRepository',
        method: 'loadSafe',
        streamId,
        finalVersion: version,
        eventsProcessed,
        hasSnapshot: !!snap,
        correlationId: options?.correlationId,
      });
      try {
        this.injectedLogger().debug({}, 'aggregate.load.complete', {
          component: 'AggregateRepository',
          method: 'loadSafe',
          streamId,
          finalVersion: version,
          eventsProcessed,
          hasSnapshot: !!snap,
          correlationId: options?.correlationId,
        });
      } catch {
        // Intentionally ignore logging errors in tests
      }

      return ok({ state, version });
    } catch (error) {
      if (error instanceof AggregateRebuildFailedError) {
        // Convert domain error to Result pattern, preserving the original error
        return err(
          withContext(AggregateRepositoryErrors.AGGREGATE_REBUILD_FAILED, {
            streamId,
            context,
            aggregate,
            entityId,
            correlationId: options?.correlationId,
            cause: error.message,
            originalError: error, // Store the original error instance
          }),
        );
      }

      const e = error as Error;
      Log.error(this.logger, 'aggregate.load.failed', {
        component: 'AggregateRepository',
        method: 'loadSafe',
        streamId,
        context,
        aggregate,
        tenant,
        entityId,
        correlationId: options?.correlationId,
        error: e.message,
        stack: e.stack,
      });

      return err(
        withContext(AggregateRepositoryErrors.AGGREGATE_REBUILD_FAILED, {
          streamId,
          context,
          aggregate,
          entityId,
          tenant,
          correlationId: options?.correlationId,
          cause: e.message,
        }),
      );
    }
  }

  /**
   * Load aggregate state and throw on errors (convenience method)
   * Returns the aggregate version (domain event index, starting at -1).
   */
  async load(
    context: string,
    aggregate: string,
    aggSchema: number,
    tenant: string,
    entityId: string,
    reducer: Reducer<State>,
    options?: {
      signal?: AbortSignal;
      readOptions?: Omit<ReadStreamOptions, 'direction'>;
      correlationId?: string;
    },
  ): Promise<{ state: State; version: number }> {
    const result = await this.loadSafe(
      context,
      aggregate,
      aggSchema,
      tenant,
      entityId,
      reducer,
      options,
    );

    if (result.ok) {
      return result.value;
    }

    // Handle different error types
    if (result.error.code === 'AGGREGATE_REPOSITORY.AGGREGATE_LOAD_CANCELLED') {
      throw new Error('Aggregate load cancelled by signal');
    }

    if (result.error.code === 'AGGREGATE_REPOSITORY.EVENT_APPLY_FAILED') {
      const errorContext = result.error.context || {};
      const streamId =
        typeof errorContext.streamId === 'string'
          ? errorContext.streamId
          : `${context}.${aggregate}.v${aggSchema}-${tenant}-${entityId}`;
      const cause =
        typeof errorContext.cause === 'string'
          ? errorContext.cause
          : result.error.detail || 'Unknown error';
      throw new AggregateRebuildFailedError(
        streamId,
        context,
        aggregate,
        entityId,
        new Error(cause),
      );
    }

    // Check if this is a wrapped AggregateRebuildFailedError and re-throw the original
    if (result.error.code === 'AGGREGATE_REPOSITORY.AGGREGATE_REBUILD_FAILED') {
      const errorContext = result.error.context || {};
      // If there's an original AggregateRebuildFailedError, re-throw it as-is
      if (errorContext.originalError instanceof AggregateRebuildFailedError) {
        throw errorContext.originalError;
      }
      if (
        typeof errorContext.cause === 'string' &&
        errorContext.cause.includes('Failed to rebuild aggregate')
      ) {
        // This was originally an AggregateRebuildFailedError, extract the original details
        const streamId =
          typeof errorContext.streamId === 'string'
            ? errorContext.streamId
            : `${context}.${aggregate}.v${aggSchema}-${tenant}-${entityId}`;
        throw new AggregateRebuildFailedError(
          streamId,
          context,
          aggregate,
          entityId,
          new Error(errorContext.cause),
        );
      }
    }

    // For other errors, preserve the original error message
    const errorContext = result.error.context || {};
    const streamId =
      typeof errorContext.streamId === 'string'
        ? errorContext.streamId
        : `${context}.${aggregate}.v${aggSchema}-${tenant}-${entityId}`;

    // If there's a cause in the context, use it; otherwise use the error detail
    const cause =
      typeof errorContext.cause === 'string'
        ? errorContext.cause
        : result.error.detail || result.error.title;

    throw new AggregateRebuildFailedError(
      streamId,
      context,
      aggregate,
      entityId,
      new Error(cause),
    );
  }

  /**
   * Save a snapshot for an aggregate.
   * `version` is the aggregate's domain version (event index).
   * `streamPosition` is the ESDB stream revision to which this snapshot corresponds.
   */
  async saveSnapshot(
    context: string,
    aggregate: string,
    aggSchema: number,
    tenant: string,
    entityId: string,
    state: State,
    version: number,
    streamPosition: bigint,
    correlationId?: string,
  ): Promise<void> {
    const { snapId } = buildStreamIds(
      context,
      aggregate,
      aggSchema,
      tenant,
      entityId,
    );

    const snapshot: Snapshot<State> = {
      aggregate: `${context}.${aggregate}`,
      aggregateSchema: aggSchema,
      tenant,
      entityId,
      state,
      version, // domain version
      streamPosition, // ESDB revision
      takenAt: new Date().toISOString(),
    };

    await this.snapshots.save(snapId, snapshot);

    Log.debug(this.logger, 'aggregate.snapshot.saved', {
      component: 'AggregateRepository',
      method: 'saveSnapshot',
      snapId,
      version,
      streamPosition: streamPosition.toString(),
      context,
      aggregate,
      tenant,
      entityId,
      correlationId,
    });
    try {
      this.injectedLogger().debug({}, 'aggregate.snapshot.saved', {
        component: 'AggregateRepository',
        method: 'saveSnapshot',
        snapId,
        version,
        streamPosition: streamPosition.toString(),
        context,
        aggregate,
        tenant,
        entityId,
        correlationId,
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * Decide if we should take a snapshot.
   * Computes `timeSinceLastSnapshot` automatically from snapshot's `takenAt`.
   */
  shouldTakeSnapshot(
    eventsProcessed: number,
    lastSnapshot?: { takenAt: string },
    thresholds = { eventCount: 200, timeInMs: 5 * 60 * 1000 },
  ): boolean {
    // Check event count threshold
    if (eventsProcessed >= thresholds.eventCount) {
      return true;
    }

    // Check time threshold
    if (lastSnapshot?.takenAt) {
      const timeSinceLastSnapshot =
        Date.now() - new Date(lastSnapshot.takenAt).getTime();
      if (timeSinceLastSnapshot >= thresholds.timeInMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Lightweight aggregate stats using tail read to avoid full replay.
   * Returns both domain version and stream position for clarity.
   */
  async getStats(
    context: string,
    aggregate: string,
    aggSchema: number,
    tenant: string,
    entityId: string,
  ): Promise<{
    streamExists: boolean;
    version: bigint; // domain version estimate
    streamPosition?: bigint; // ESDB stream revision
    snapshotExists: boolean;
    snapshotVersion?: number;
    eventsSinceSnapshot: number;
  }> {
    const { streamId, snapId } = buildStreamIds(
      context,
      aggregate,
      aggSchema,
      tenant,
      entityId,
    );

    // 1) Latest stream revision via single backward read
    let latestRevision = -1n;
    let streamExists = false;
    try {
      const iter = this.es.readStream(streamId, {
        direction: BACKWARDS,
        maxCount: 1,
      });
      const iterProto2 = iter as unknown as {
        [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
      };
      if (iter && typeof iterProto2[Symbol.asyncIterator] === 'function') {
        for await (const resolved of iter) {
          // If we read one event, and it's non-null, its revision == current head
          if (resolved && resolved.event) {
            latestRevision = resolved.event.revision ?? -1n;
            streamExists = true;
            break;
          }
          // otherwise continue and treat as no-event
        }
      }
    } catch {
      // stream may not exist
    }

    // 2) Snapshot info
    const snapshotStats = await this.snapshots.getStats(snapId);

    // Assuming domain version == revision for simplicity
    // In practice, you might need to adjust this mapping
    const version = streamExists ? latestRevision : -1n;
    const snapVer = snapshotStats.version;
    const eventsSinceSnapshot =
      snapVer != null && streamExists
        ? (() => {
            const diff = version - BigInt(snapVer);
            return diff < 0n ? 0 : Number(diff); // return as number for UI, safe if bounded
          })()
        : streamExists
          ? 1 // at least the head event exists
          : 0;

    return {
      streamExists,
      version,
      streamPosition: streamExists ? latestRevision : undefined,
      snapshotExists: snapshotStats.exists,
      snapshotVersion: snapshotStats.version,
      eventsSinceSnapshot,
    };
  }
}
