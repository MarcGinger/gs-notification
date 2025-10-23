import { Module, Global } from '@nestjs/common';
import { EventStoreModule } from './eventstore/eventstore.module';
import { EventStoreService } from './eventstore/eventstore.service';

import { BullMQModule } from './queue/bullmq.module';
import { SnapshotRepository } from './eventstore/snapshot.repository';
import { AggregateRepository } from './eventstore/aggregate.repository';

import { RedisCheckpointStore } from './projections/redis-checkpoint.store';
import { CatchUpRunner } from './projections/catchup.runner';

import { RedisOutboxRepository } from './outbox/redis-outbox.repository';
import { OutboxPublisher } from '../application/outbox/outbox.publisher';

import Redis from 'ioredis';
import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { APP_LOGGER, Logger } from '../logging';
import { AppConfigUtil } from '../config/app-config.util';
import { LoggingModule } from '../logging/logging.module';
import { InMemoryCacheService } from '../application/caching/cache.service';

import {
  CHECKPOINT_STORE,
  OUTBOX_REPOSITORY,
  EVENTSTORE_CLIENT,
  CACHE_SERVICE,
  CATCHUP_RUNNER,
} from './infrastructure.tokens';

@Global()
@Module({
  imports: [
    LoggingModule, // Required for APP_LOGGER
    EventStoreModule, // Must export EventStoreService and EventStoreDBClient
    BullMQModule.register({
      redisUrl: AppConfigUtil.getRedisConfig().url,
      queues: [
        {
          name: 'NotificationQueue',
          defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
        },
        {
          name: 'ProjectionQueue',
          defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
        },
      ], // Configure the required queues
    }), // Must export 'BullMQ_Redis_Client' and queue tokens
  ],
  providers: [
    // ----- EventStore Client Provider -----
    // Extract EventStoreDBClient from EventStoreService for explicit injection
    {
      provide: EVENTSTORE_CLIENT,
      inject: [EventStoreService],
      useFactory: (eventStoreService: EventStoreService) => {
        // Access the private client property via service method
        return eventStoreService.getClient();
      },
    },

    // ----- EventStore Infrastructure -----
    // SnapshotRepository needs EventStoreDBClient + Redis (hot cache)
    {
      provide: SnapshotRepository,
      inject: [EVENTSTORE_CLIENT, 'IORedis', APP_LOGGER],
      useFactory: (
        esdbClient: KurrentDBClient,
        redis: Redis,
        logger: Logger,
      ) => {
        return new SnapshotRepository<any>(esdbClient, logger, redis);
      },
    },

    // AggregateRepository depends on EventStoreService + SnapshotRepository
    AggregateRepository,

    // ----- Projections Infrastructure -----
    // RedisCheckpointStore with environment-aware prefix
    {
      provide: RedisCheckpointStore,
      inject: ['IORedis', APP_LOGGER],
      useFactory: (redis: Redis, logger: Logger) => {
        const envPrefix = `${AppConfigUtil.getEnvironment()}:`;
        return new RedisCheckpointStore(redis, logger, envPrefix);
      },
    },
    { provide: CHECKPOINT_STORE, useExisting: RedisCheckpointStore },

    // Projection runners with structured logging
    CatchUpRunner,
    { provide: CATCHUP_RUNNER, useExisting: CatchUpRunner },

    // ----- Outbox Infrastructure -----
    // RedisOutboxRepository with explicit Redis injection
    {
      provide: RedisOutboxRepository,
      inject: ['IORedis', APP_LOGGER],
      useFactory: (redis: Redis, logger: Logger) => {
        return new RedisOutboxRepository(redis, logger);
      },
    },
    { provide: OUTBOX_REPOSITORY, useExisting: RedisOutboxRepository },

    // OutboxPublisher depends on outbox repo + queue(s)
    OutboxPublisher,

    // ----- Cache Infrastructure -----
    // InMemoryCacheService for general caching needs
    {
      provide: CACHE_SERVICE,
      useClass: InMemoryCacheService,
    },
  ],
  exports: [
    // Core services
    EVENTSTORE_CLIENT,

    // EventStore infrastructure
    SnapshotRepository,
    AggregateRepository,

    // Projections infrastructure
    RedisCheckpointStore,
    CHECKPOINT_STORE,
    CatchUpRunner,
    CATCHUP_RUNNER,

    // Outbox infrastructure
    RedisOutboxRepository,
    OUTBOX_REPOSITORY,
    OutboxPublisher,

    // Cache infrastructure
    CACHE_SERVICE,
  ],
})
export class InfrastructureModule {}
