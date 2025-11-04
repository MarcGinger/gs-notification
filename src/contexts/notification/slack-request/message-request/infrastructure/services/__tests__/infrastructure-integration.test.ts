/**
 * Infrastructure Integration Test
 *
 * Tests the BullMQ infrastructure integration following refinement.md:
 * - BullMQ job schema and queue setup
 * - Redis idempotency service SETNX patterns
 * - Projector dispatch-once logic
 * - Queue service job enqueuing
 * - Worker service foundation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { SLACK_REQUEST_DI_TOKENS } from 'src/contexts/notification/slack-request/slack-request.constants';
import {
  IRedisIdempotencyService,
  RedisIdempotencyService,
} from 'src/shared/infrastructure';
import { MessageRequestQueueService } from '../message-request-queue.service';
import { SendMessageJob } from '../message-request-queue.types';
import { SendMessageWorkerService } from '../send-message-worker.service';

describe('Infrastructure Integration', () => {
  let module: TestingModule;
  let redis: Redis;
  let idempotencyService: IRedisIdempotencyService;
  let queueService: MessageRequestQueueService;
  let workerService: SendMessageWorkerService;

  // Test data
  const testTenant = 'test-tenant';
  const testMessageRequestId = 'msg-req-123';
  const testJob: SendMessageJob = {
    messageRequestId: testMessageRequestId,
    tenant: testTenant,
    threadTs: undefined,
  };

  beforeAll(async () => {
    // Create test module with minimal dependencies
    module = await Test.createTestingModule({
      providers: [
        {
          provide: 'MessageRequestIdempotencyService',
          useClass: RedisIdempotencyService,
        },
        {
          provide: 'IDEMPOTENCY_CONFIG',
          useValue: {
            namespace: 'notification.slack',
            version: 'v1',
            entityType: 'message-request',
            executionTtl: 900,
          },
        },
        {
          provide: 'APP_LOGGER',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'REDIS',
          useFactory: () => redis, // Use the mock redis from above
        },
        MessageRequestQueueService,
        SendMessageWorkerService,
        {
          provide: SLACK_REQUEST_DI_TOKENS.IO_REDIS,
          useFactory: () => {
            // Mock Redis for testing
            const mockRedis = {
              set: jest.fn().mockResolvedValue('OK'),
              get: jest.fn().mockResolvedValue(null),
              del: jest.fn().mockResolvedValue(1),
              ttl: jest.fn().mockResolvedValue(-1),
              // For SETNX operation
              setnx: jest.fn().mockResolvedValue(1), // Success
              expire: jest.fn().mockResolvedValue(1),
            };
            return mockRedis;
          },
        },
        {
          provide: 'Queue:MessageRequestQueue',
          useFactory: () => {
            // Mock BullMQ Queue for testing
            const mockQueue = {
              add: jest.fn().mockResolvedValue({ id: 'job-123' }),
              getWaiting: jest.fn().mockResolvedValue([]),
              getActive: jest.fn().mockResolvedValue([]),
              getCompleted: jest.fn().mockResolvedValue([]),
              getFailed: jest.fn().mockResolvedValue([]),
              getDelayed: jest.fn().mockResolvedValue([]),
              pause: jest.fn().mockResolvedValue(undefined),
              resume: jest.fn().mockResolvedValue(undefined),
              clean: jest.fn().mockResolvedValue([]),
              close: jest.fn().mockResolvedValue(undefined),
            };
            return mockQueue;
          },
        },
        // Mock config query services
        {
          provide: 'WORKSPACE_QUERY_TOKEN',
          useValue: { findById: jest.fn() },
        },
        {
          provide: 'TEMPLATE_QUERY_TOKEN',
          useValue: { findById: jest.fn() },
        },
        {
          provide: 'CHANNEL_QUERY_TOKEN',
          useValue: { findById: jest.fn() },
        },
        {
          provide: 'APP_CONFIG_QUERY_TOKEN',
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    // Get service instances
    redis = module.get<Redis>(SLACK_REQUEST_DI_TOKENS.IO_REDIS);
    idempotencyService = module.get<IRedisIdempotencyService>(
      'MessageRequestIdempotencyService',
    );
    queueService = module.get<MessageRequestQueueService>(
      MessageRequestQueueService,
    );
    workerService = module.get<SendMessageWorkerService>(
      SendMessageWorkerService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Redis Idempotency Service', () => {
    it('should successfully acquire dispatch lock on first attempt', async () => {
      // Mock SETNX to return 1 (success, first time)
      (redis.setnx as jest.Mock).mockResolvedValue(1);

      const result = await idempotencyService.acquireDispatchLock(
        testTenant,
        testMessageRequestId,
      );

      expect(result.success).toBe(true);
      expect(result.isFirst).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify Redis SETNX was called with correct key
      expect(redis.setnx).toHaveBeenCalledWith(
        `message-request:dispatch-lock:{${testTenant}}:${testMessageRequestId}`,
        '1',
      );

      // Verify TTL was set
      expect(redis.expire).toHaveBeenCalledWith(
        `message-request:dispatch-lock:{${testTenant}}:${testMessageRequestId}`,
        300, // 5 minutes TTL
      );
    });

    it('should detect duplicate dispatch attempt', async () => {
      // Mock SETNX to return 0 (key already exists)
      (redis.setnx as jest.Mock).mockResolvedValue(0);

      const result = await idempotencyService.acquireDispatchLock(
        testTenant,
        testMessageRequestId,
      );

      expect(result.success).toBe(true);
      expect(result.isFirst).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should successfully acquire send lock on first attempt', async () => {
      // Mock SETNX to return 1 (success, first time)
      (redis.setnx as jest.Mock).mockResolvedValue(1);

      const result = await idempotencyService.acquireExecutionLock(
        testTenant,
        testMessageRequestId,
      );

      expect(result.success).toBe(true);
      expect(result.isFirst).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify Redis SETNX was called with correct key
      expect(redis.setnx).toHaveBeenCalledWith(
        `message-request:send-lock:{${testTenant}}:${testMessageRequestId}`,
        '1',
      );

      // Verify TTL was set
      expect(redis.expire).toHaveBeenCalledWith(
        `message-request:send-lock:{${testTenant}}:${testMessageRequestId}`,
        600, // 10 minutes TTL
      );
    });
  });

  describe('Queue Service', () => {
    it('should successfully enqueue simple SendMessageJob', async () => {
      const result = await queueService.enqueueSimpleSendMessageJob(testJob, {
        priority: 1,
        delay: 0,
        attempts: 1,
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.error).toBeUndefined();

      // Verify BullMQ add was called correctly
      const mockQueue = module.get('Queue:MessageRequestQueue');
      expect(mockQueue.add).toHaveBeenCalledWith('SendMessageJob', testJob, {
        priority: 1,
        delay: 0,
        attempts: 1,
      });
    });

    it('should get queue statistics', async () => {
      const stats = await queueService.getQueueInfo();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('Worker Service Foundation', () => {
    it('should initialize without errors', () => {
      expect(workerService).toBeDefined();
      // Worker service is created but doesn't start until onModuleInit
      // This test just verifies the dependency injection works
    });
  });

  describe('End-to-End Infrastructure Flow', () => {
    it('should demonstrate the complete flow components', async () => {
      // This test demonstrates the infrastructure components work together
      // In a real scenario: Projector → IdempotencyService → QueueService → Worker

      // Step 1: Projector would call idempotency service (dispatch-once)
      (redis.setnx as jest.Mock).mockResolvedValue(1); // First time
      const dispatchResult = await idempotencyService.acquireDispatchLock(
        testTenant,
        testMessageRequestId,
      );

      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.isFirst).toBe(true);

      // Step 2: If first time, projector would enqueue job
      const enqueueResult = await queueService.enqueueSimpleSendMessageJob(
        testJob,
        { priority: 0, delay: 0, attempts: 1 },
      );

      expect(enqueueResult.success).toBe(true);
      expect(enqueueResult.jobId).toBeDefined();

      // Step 3: Worker would process job (using execution-lock for idempotency)
      (redis.setnx as jest.Mock).mockResolvedValue(1); // First time processing
      const sendLockResult = await idempotencyService.acquireExecutionLock(
        testTenant,
        testMessageRequestId,
      );

      expect(sendLockResult.success).toBe(true);
      expect(sendLockResult.isFirst).toBe(true);

      // Verify all Redis operations used correct tenant hash-tags for cluster locality
      const dispatchKey = `message-request:dispatch-lock:{${testTenant}}:${testMessageRequestId}`;
      const sendKey = `message-request:send-lock:{${testTenant}}:${testMessageRequestId}`;

      expect(redis.setnx).toHaveBeenCalledWith(dispatchKey, '1');
      expect(redis.setnx).toHaveBeenCalledWith(sendKey, '1');

      // Both keys use same tenant hash-tag for Redis cluster locality
      expect(dispatchKey.includes(`{${testTenant}}`)).toBe(true);
      expect(sendKey.includes(`{${testTenant}}`)).toBe(true);
    });

    it('should prevent duplicate dispatch when already processed', async () => {
      // Mock dispatch lock already exists (not first time)
      (redis.setnx as jest.Mock).mockResolvedValue(0);

      const dispatchResult = await idempotencyService.acquireDispatchLock(
        testTenant,
        testMessageRequestId,
      );

      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.isFirst).toBe(false); // Already dispatched

      // In real flow, projector would skip enqueuing since not first time
      // This prevents duplicate jobs from being created
    });

    it('should prevent duplicate processing when already sent', async () => {
      // Mock send lock already exists (not first time)
      (redis.setnx as jest.Mock).mockResolvedValue(0);

      const sendLockResult = await idempotencyService.acquireExecutionLock(
        testTenant,
        testMessageRequestId,
      );

      expect(sendLockResult.success).toBe(true);
      expect(sendLockResult.isFirst).toBe(false); // Already processed

      // In real flow, worker would skip processing since already sent
      // This prevents duplicate messages from being sent to Slack
    });
  });
});
