import {
  Global,
  Module,
  DynamicModule,
  OnApplicationShutdown,
  Inject,
} from '@nestjs/common';
import {
  Queue,
  QueueEvents,
  QueueOptions,
  Worker,
  WorkerOptions,
} from 'bullmq';
import Redis, { RedisOptions } from 'ioredis';
import { APP_LOGGER, Log, componentLogger, Logger } from '../../logging';
import { LoggingModule } from '../../logging/logging.module';
import {
  BULLMQ_MODULE_OPTIONS,
  BULLMQ_REDIS_CLIENT,
  BULLMQ_CONNECTION_OPTIONS,
  IO_REDIS,
} from '../../constants/injection-tokens';

const COMPONENT = 'BullMQModule';

/**
 * Configuration for individual queue
 */
export interface BullQueueConfig {
  name: string;
  defaultJobOptions?: QueueOptions['defaultJobOptions'];
  workerOptions?: Omit<WorkerOptions, 'connection'>;
}

/**
 * Worker processor configuration
 */
export interface BullWorkerConfig {
  queueName: string;
  processor: string | ((job: any) => Promise<any>);
  options?: Omit<WorkerOptions, 'connection'>;
}

/**
 * BullMQ module configuration options
 */
export interface BullModuleOptions {
  /** Redis connection URL (supports redis:// and rediss:// for TLS) */
  redisUrl?: string;
  /** Alternative explicit Redis options */
  redis?: RedisOptions;
  /** Redis key prefix for environment isolation (e.g., 'app:prod:') */
  keyPrefix?: string;
  /** Queue configurations */
  queues: BullQueueConfig[];
  /** Worker configurations (optional) */
  workers?: BullWorkerConfig[];
  /** Enable metrics collection and logging */
  enableMetrics?: boolean;
}

/**
 * Production-ready BullMQ module with:
 * - Dedicated connections per role (client, subscriber, blocking)
 * - QueueEvents for each queue with separate connections
 * - Graceful shutdown handling
 * - Environment-aware key namespacing
 * - Dynamic module registration
 * - Optional worker management
 * - TLS support (rediss://)
 * - Metrics collection
 */
@Global()
@Module({})
export class BullMQModule implements OnApplicationShutdown {
  private static createdQueues: Queue[] = [];
  private static createdQueueEvents: QueueEvents[] = [];
  private static createdWorkers: Worker[] = [];
  private static providedRedisClients: Redis[] = [];

  private readonly logger: Logger;

  constructor(
    @Inject(APP_LOGGER) private readonly moduleLogger: Logger,
    @Inject(BULLMQ_MODULE_OPTIONS) private readonly opts: BullModuleOptions,
  ) {
    this.logger = componentLogger(this.moduleLogger, COMPONENT);
  }

  /**
   * Register BullMQ module with dynamic configuration
   */
  static register(options: BullModuleOptions): DynamicModule {
    const providers = [
      {
        provide: BULLMQ_MODULE_OPTIONS,
        useValue: options,
      },
      // Base Redis client factory (for client role operations)
      {
        provide: BULLMQ_REDIS_CLIENT,
        useFactory: () => {
          const connectionOptions =
            BullMQModule.createConnectionOptions(options);
          const client = new Redis(connectionOptions);
          BullMQModule.providedRedisClients.push(client);
          return client;
        },
      },
      // Connection options provider for BullMQ internal connection management
      {
        provide: BULLMQ_CONNECTION_OPTIONS,
        useFactory: () => BullMQModule.createConnectionOptions(options),
      },
      // Queue providers (one per configured queue)
      ...options.queues.flatMap((queueConfig) => [
        {
          provide: `Queue:${queueConfig.name}`,
          inject: [
            BULLMQ_CONNECTION_OPTIONS,
            BULLMQ_MODULE_OPTIONS,
            APP_LOGGER,
          ],
          useFactory: (
            connectionOptions: RedisOptions,
            moduleOpts: BullModuleOptions,
            baseLogger: Logger,
          ) => {
            // Use connection options so BullMQ manages role-specific connections internally
            const queue = new Queue(queueConfig.name, {
              connection: connectionOptions,
              defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                ...queueConfig.defaultJobOptions,
              },
            });

            BullMQModule.createdQueues.push(queue);

            // Set up metrics if enabled
            if (moduleOpts.enableMetrics) {
              BullMQModule.setupQueueMetrics(
                queue,
                queueConfig.name,
                baseLogger,
              );
            }

            return queue;
          },
        },
        // Also provide the queue with just the name for backward compatibility
        {
          provide: queueConfig.name,
          useExisting: `Queue:${queueConfig.name}`,
        },
      ]),
      // QueueEvents providers (one per queue with dedicated connections)
      ...options.queues.map((queueConfig) => ({
        provide: `QueueEvents:${queueConfig.name}`,
        inject: [BULLMQ_MODULE_OPTIONS, APP_LOGGER],
        useFactory: (moduleOpts: BullModuleOptions, baseLogger: Logger) => {
          // Create dedicated Redis connection for QueueEvents
          const connectionOptions =
            BullMQModule.createConnectionOptions(moduleOpts);
          const eventsConnection = new Redis(connectionOptions);
          BullMQModule.providedRedisClients.push(eventsConnection);

          const queueEvents = new QueueEvents(queueConfig.name, {
            connection: eventsConnection,
            autorun: true,
          });

          BullMQModule.createdQueueEvents.push(queueEvents);

          // Set up event metrics if enabled
          if (moduleOpts.enableMetrics) {
            BullMQModule.setupQueueEventsMetrics(
              queueEvents,
              queueConfig.name,
              baseLogger,
            );
          }

          return queueEvents;
        },
      })),
      // Worker providers (if configured)
      ...(options.workers || []).map((workerConfig) => ({
        provide: `Worker:${workerConfig.queueName}`,
        inject: [BULLMQ_CONNECTION_OPTIONS],
        useFactory: (connectionOptions: RedisOptions) => {
          const worker = new Worker(
            workerConfig.queueName,
            workerConfig.processor,
            {
              connection: connectionOptions,
              ...workerConfig.options,
            },
          );

          BullMQModule.createdWorkers.push(worker);
          return worker;
        },
      })),
    ];

    const exportsArray = [
      BULLMQ_REDIS_CLIENT,
      BULLMQ_CONNECTION_OPTIONS,
      ...options.queues.map((q) => `Queue:${q.name}`),
      ...options.queues.map((q) => q.name), // Also export plain queue names
      ...options.queues.map((q) => `QueueEvents:${q.name}`),
      ...(options.workers || []).map((w) => `Worker:${w.queueName}`),
      BULLMQ_MODULE_OPTIONS,
    ];

    return {
      module: BullMQModule,
      imports: [LoggingModule],
      providers: [
        ...providers,
        // Add IORedis alias as a provider
        { provide: IO_REDIS, useExisting: BULLMQ_REDIS_CLIENT },
      ],
      exports: [
        ...exportsArray,
        // Export IORedis alias
        'IORedis',
      ],
      global: true,
    };
  }

  /**
   * Create Redis connection options with BullMQ optimizations
   */
  private static createConnectionOptions(
    options: BullModuleOptions,
  ): RedisOptions {
    if (options.redis) {
      return {
        ...options.redis,
        keyPrefix: options.keyPrefix,
        maxRetriesPerRequest: null, // Required for BullMQ blocking operations
        lazyConnect: true,
        enableReadyCheck: false,
        enableOfflineQueue: true, // Allow command queuing during connection establishment
      };
    }

    const redisUrl = options.redisUrl || 'redis://localhost:6379';

    // Parse URL to extract connection details
    const url = new URL(redisUrl);
    const isTLS = url.protocol === 'rediss:';

    return {
      host: url.hostname,
      port: parseInt(url.port) || (isTLS ? 6380 : 6379),
      password: url.password || undefined,
      username: url.username || undefined,
      db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
      tls: isTLS ? {} : undefined,
      keyPrefix: options.keyPrefix,
      maxRetriesPerRequest: null, // Required for BullMQ
      lazyConnect: true,
      enableReadyCheck: false,
      enableOfflineQueue: true, // Allow command queuing during connection establishment
    };
  }

  /**
   * Set up queue metrics collection
   */
  private static setupQueueMetrics(
    queue: Queue,
    queueName: string,
    baseLogger?: Logger,
  ): void {
    const logger = baseLogger
      ? baseLogger.child({ component: `Queue:${queueName}` })
      : undefined;

    // Helper to safely get job ID
    const getJobId = (job: any): string => {
      if (job && typeof job === 'object' && 'id' in job) {
        return String((job as { id: unknown }).id);
      }
      return 'unknown';
    };

    // Helper to safely get error message
    const getErrorMessage = (err: any): string => {
      if (err instanceof Error) {
        return err.message;
      }
      if (err && typeof err === 'object' && 'message' in err) {
        return String((err as { message: unknown }).message);
      }
      return String(err);
    };

    // Note: Some events may not be available on all Queue versions
    // Using basic logging without accessing job properties directly
    queue.on('waiting' as any, (job: any) => {
      if (logger)
        Log.debug(logger, 'queue.job.waiting', {
          service: 'shared',
          component: `Queue:${queueName}`,
          method: 'setupQueueMetrics',
          queue: queueName,
          jobId: getJobId(job),
        });
    });

    queue.on('active' as any, (job: any) => {
      if (logger)
        Log.debug(logger, 'queue.job.active', {
          service: 'shared',
          component: `Queue:${queueName}`,
          method: 'setupQueueMetrics',
          queue: queueName,
          jobId: getJobId(job),
        });
    });

    queue.on('completed' as any, (job: any) => {
      if (logger)
        Log.info(logger, 'queue.job.completed', {
          service: 'shared',
          component: `Queue:${queueName}`,
          method: 'setupQueueMetrics',
          queue: queueName,
          jobId: getJobId(job),
        });
    });

    queue.on('failed' as any, (job: any, err: any) => {
      if (logger)
        Log.error(logger, 'queue.job.failed', {
          method: 'setupQueueMetrics',
          queue: queueName,
          jobId: getJobId(job),
          error: getErrorMessage(err),
        });
    });

    queue.on('stalled' as any, (job: any) => {
      if (logger)
        Log.warn(logger, 'queue.job.stalled', {
          service: 'shared',
          component: `Queue:${queueName}`,
          method: 'setupQueueMetrics',
          queue: queueName,
          jobId: getJobId(job),
        });
    });
  }

  /**
   * Set up queue events metrics collection
   */
  private static setupQueueEventsMetrics(
    queueEvents: QueueEvents,
    queueName: string,
    baseLogger?: Logger,
  ): void {
    const logger = baseLogger
      ? baseLogger.child({ component: `QueueEvents:${queueName}` })
      : undefined;

    queueEvents.on('waiting', ({ jobId }) => {
      if (logger)
        Log.debug(logger, 'queue.events.waiting', {
          service: 'shared',
          component: `QueueEvents:${queueName}`,
          method: 'setupQueueEventsMetrics',
          queue: queueName,
          jobId,
        });
    });

    queueEvents.on('active', ({ jobId, prev }) => {
      const waitTime = prev === 'waiting' ? Date.now() - parseInt(jobId) : 0;
      if (logger)
        Log.debug(logger, 'queue.events.active', {
          service: 'shared',
          component: `QueueEvents:${queueName}`,
          method: 'setupQueueEventsMetrics',
          queue: queueName,
          jobId,
          waitTime,
        });
    });

    queueEvents.on('completed', ({ jobId }) => {
      if (logger)
        Log.info(logger, 'queue.events.completed', {
          service: 'shared',
          component: `QueueEvents:${queueName}`,
          method: 'setupQueueEventsMetrics',
          queue: queueName,
          jobId,
        });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      if (logger)
        Log.error(logger, 'queue.events.failed', {
          method: 'setupQueueEventsMetrics',
          queue: queueName,
          jobId,
          failedReason,
          error: String(failedReason),
        });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      if (logger)
        Log.warn(logger, 'queue.events.stalled', {
          service: 'shared',
          component: `QueueEvents:${queueName}`,
          method: 'setupQueueEventsMetrics',
          queue: queueName,
          jobId,
        });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      if (logger)
        Log.debug(logger, 'queue.events.progress', {
          service: 'shared',
          component: `QueueEvents:${queueName}`,
          method: 'setupQueueEventsMetrics',
          queue: queueName,
          jobId,
          data,
        });
    });
  }

  /**
   * Graceful shutdown - close all BullMQ resources
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    Log.info(this.logger, 'bullmq.shutdown.start', {
      service: 'shared',
      component: 'BullMQModule',
      method: 'onApplicationShutdown',
      signal,
    });

    // Close workers first (stop processing new jobs)
    for (const worker of BullMQModule.createdWorkers.splice(0)) {
      try {
        Log.debug(this.logger, 'bullmq.worker.closing', {
          service: 'shared',
          component: 'BullMQModule',
          method: 'onApplicationShutdown',
          worker: worker.name,
        });

        await worker.close();
      } catch (error) {
        Log.error(this.logger, 'bullmq.worker.close_error', {
          method: 'onApplicationShutdown',
          worker: worker.name,
          error: String(error instanceof Error ? error.message : error),
        });
      }
    }

    // Close queues
    for (const queue of BullMQModule.createdQueues.splice(0)) {
      try {
        Log.debug(this.logger, 'bullmq.queue.closing', {
          service: 'shared',
          component: 'BullMQModule',
          method: 'onApplicationShutdown',
          queue: queue.name,
        });

        await queue.close();
      } catch (error) {
        Log.error(this.logger, 'bullmq.queue.close_error', {
          method: 'onApplicationShutdown',
          queue: queue.name,
          error: String(error instanceof Error ? error.message : error),
        });
      }
    }

    // Close queue events
    for (const queueEvents of BullMQModule.createdQueueEvents.splice(0)) {
      try {
        Log.debug(this.logger, 'bullmq.queueevents.closing', {
          service: 'shared',
          component: 'BullMQModule',
          method: 'onApplicationShutdown',
          queueEvents: queueEvents.name,
        });

        await queueEvents.close();
      } catch (error) {
        Log.error(this.logger, 'bullmq.queueevents.close_error', {
          method: 'onApplicationShutdown',
          queueEvents: queueEvents.name,
          error: String(error instanceof Error ? error.message : error),
        });
      }
    }

    // Close Redis clients
    for (const redis of BullMQModule.providedRedisClients.splice(0)) {
      try {
        Log.debug(this.logger, 'bullmq.redis.closing', {
          service: 'shared',
          component: 'BullMQModule',
          method: 'onApplicationShutdown',
        });

        await redis.quit();
      } catch (error) {
        Log.error(this.logger, 'bullmq.redis.close_error', {
          method: 'onApplicationShutdown',
          error: String(error instanceof Error ? error.message : error),
        });
      }
    }

    Log.info(this.logger, 'bullmq.shutdown.complete', {
      service: 'shared',
      component: 'BullMQModule',
      method: 'onApplicationShutdown',
    });
  }
}
