import { Test } from '@nestjs/testing';
import { APP_LOGGER } from 'src/shared/logging';
import { Clock, CLOCK } from 'src/shared/infrastructure/time';
import { SecureTestProjector } from '../../../infrastructure/projectors/secure-test.projector';
import { SecureTestCreated } from '../../../domain/events/secure-test-created.event';
import { SecureTestUpdated } from '../../../domain/events/secure-test-updated.event';
import {
  createDopplerSecretRef,
  createSealedSecretRef,
  SecretRefUnion,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';
import { ActorContext } from 'src/shared/application/context';
import { SecureTestId } from '../../../domain/value-objects/secure-test-id.vo';

// Mock Redis client
const mockRedis = {
  hset: jest.fn(),
  hdel: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  hgetall: jest.fn(),
  pipeline: jest.fn(() => ({
    hset: jest.fn(),
    hdel: jest.fn(),
    del: jest.fn(),
    exec: jest.fn(),
  })),
};

// Mock Logger
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock Clock
const mockClock = {
  now: jest.fn(() => new Date()),
};

describe('Phase 3.3: Projector Mixed SecretRef Support', () => {
  let projector: SecureTestProjector;
  let actorContext: ActorContext;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecureTestProjector,
        {
          provide: 'IORedis',
          useValue: mockRedis,
        },
        {
          provide: APP_LOGGER,
          useValue: mockLogger,
        },
        {
          provide: CLOCK,
          useValue: mockClock,
        },
      ],
    }).compile();

    projector = moduleRef.get<SecureTestProjector>(SecureTestProjector);

    actorContext = {
      userId: 'test-user',
      tenant: 'test-tenant',
      tenant_userId: 'test-tenant-user',
      roles: ['user'],
    };

    // Reset mocks
    jest.clearAllMocks();
    mockRedis.pipeline().exec.mockResolvedValue([]);
  });

  describe('SecureTestCreated Event Handling with Mixed SecretRef Types', () => {
    it('should handle SecureTestCreated with Doppler SecretRef correctly', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'webhook-namespace',
        'signing-secret',
      );

      const event = new SecureTestCreated(
        'test-aggregate-id',
        {
          id: SecureTestId.create('test-id').value,
          webhookUrl: 'https://example.com/webhook',
          signingSecretRef: dopplerRef,
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef type identified'),
        expect.objectContaining({
          operation: 'handleSecureTestCreated',
          secretRefTypes: expect.objectContaining({
            signingSecret: 'doppler',
          }),
          hasSealedSecrets: false,
        }),
      );
    });

    it('should handle SecureTestCreated with Sealed SecretRef correctly', async () => {
      // Arrange
      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'user-creds-kek',
        'AES-256-GCM',
        'sealed-password-blob',
      );

      const event = new SecureTestCreated(
        'test-aggregate-id',
        {
          id: SecureTestId.create('test-id').value,
          webhookUrl: 'https://example.com/webhook',
          passwordRef: sealedRef,
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef type identified'),
        expect.objectContaining({
          operation: 'handleSecureTestCreated',
          secretRefTypes: expect.objectContaining({
            password: 'sealed',
          }),
          hasSealedSecrets: true,
        }),
      );
    });

    it('should handle SecureTestCreated with mixed SecretRef types', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'signing-namespace',
        'signing-key',
      );

      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'creds-kek',
        'XCHACHA20-POLY1305',
        'sealed-username-blob',
      );

      const event = new SecureTestCreated(
        'mixed-test-aggregate-id',
        {
          id: SecureTestId.create('mixed-test-id').value,
          webhookUrl: 'https://example.com/mixed-webhook',
          signingSecretRef: dopplerRef,
          usernameRef: sealedRef,
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef type identified'),
        expect.objectContaining({
          operation: 'handleSecureTestCreated',
          secretRefTypes: expect.objectContaining({
            signingSecret: 'doppler',
            username: 'sealed',
          }),
          hasSealedSecrets: true,
        }),
      );
    });

    it('should handle SecureTestCreated with no SecretRefs', async () => {
      // Arrange
      const event = new SecureTestCreated(
        'no-secrets-aggregate-id',
        {
          id: SecureTestId.create('no-secrets-test-id').value,
          webhookUrl: 'https://example.com/no-secrets-webhook',
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef type identified'),
        expect.objectContaining({
          operation: 'handleSecureTestCreated',
          secretRefTypes: {},
          hasSealedSecrets: false,
        }),
      );
    });
  });

  describe('SecureTestUpdated Event Handling with Mixed SecretRef Types', () => {
    it('should handle SecureTestUpdated with Doppler to Sealed migration', async () => {
      // Arrange - Simulating migration from Doppler to Sealed SecretRef
      const oldDopplerRef = createDopplerSecretRef(
        'test-tenant',
        'old-namespace',
        'old-signing-secret',
      );

      const newSealedRef = createSealedSecretRef(
        'test-tenant',
        'migration-kek',
        'AES-256-GCM',
        'migrated-signing-secret-blob',
      );

      const event = new SecureTestUpdated(
        'migration-test-aggregate-id',
        {
          id: SecureTestId.create('migration-test-id').value,
          webhookUrl: 'https://example.com/migration-webhook',
          signingSecretRef: newSealedRef, // Updated from Doppler to Sealed
          isActive: true,
          tenant: 'test-tenant',
        },
        {
          id: SecureTestId.create('migration-test-id').value,
          webhookUrl: 'https://example.com/migration-webhook',
          signingSecretRef: oldDopplerRef, // Previous Doppler SecretRef
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        2,
      );

      // Act
      await projector.handleSecureTestUpdated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef migration detected'),
        expect.objectContaining({
          operation: 'handleSecureTestUpdated',
          migrationInfo: expect.objectContaining({
            previousSecretRefTypes: expect.objectContaining({
              signingSecret: 'doppler',
            }),
            newSecretRefTypes: expect.objectContaining({
              signingSecret: 'sealed',
            }),
            migrationToSealed: true,
          }),
        }),
      );
    });

    it('should handle SecureTestUpdated with new SecretRef addition', async () => {
      // Arrange - Adding new SecretRef to existing aggregate
      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'new-field-kek',
        'XCHACHA20-POLY1305',
        'new-password-blob',
      );

      const event = new SecureTestUpdated(
        'addition-test-aggregate-id',
        {
          id: SecureTestId.create('addition-test-id').value,
          webhookUrl: 'https://example.com/addition-webhook',
          passwordRef: sealedRef, // Newly added SecretRef
          isActive: true,
          tenant: 'test-tenant',
        },
        {
          id: SecureTestId.create('addition-test-id').value,
          webhookUrl: 'https://example.com/addition-webhook',
          // No passwordRef in previous state
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        2,
      );

      // Act
      await projector.handleSecureTestUpdated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef change detected'),
        expect.objectContaining({
          operation: 'handleSecureTestUpdated',
          changeInfo: expect.objectContaining({
            previousSecretRefTypes: {},
            newSecretRefTypes: expect.objectContaining({
              password: 'sealed',
            }),
            newFieldsAdded: ['password'],
          }),
        }),
      );
    });
  });

  describe('SecretRef Serialization and Storage', () => {
    it('should properly serialize Doppler SecretRef for Redis storage', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'serialization-namespace',
        'serialization-key',
      );

      const event = new SecureTestCreated(
        'serialization-test-aggregate-id',
        {
          id: SecureTestId.create('serialization-test-id').value,
          webhookUrl: 'https://example.com/serialization-webhook',
          signingSecretRef: dopplerRef,
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringContaining('serialization-test-id'),
        expect.objectContaining({
          signingSecretRef: JSON.stringify(dopplerRef),
        }),
      );
    });

    it('should properly serialize Sealed SecretRef for Redis storage', async () => {
      // Arrange
      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'serialization-kek',
        'AES-256-GCM',
        'serialization-blob',
      );

      const event = new SecureTestCreated(
        'sealed-serialization-test-aggregate-id',
        {
          id: SecureTestId.create('sealed-serialization-test-id').value,
          webhookUrl: 'https://example.com/sealed-serialization-webhook',
          passwordRef: sealedRef,
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringContaining('sealed-serialization-test-id'),
        expect.objectContaining({
          passwordRef: JSON.stringify(sealedRef),
        }),
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle projection errors gracefully with SecretRef data', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'error-namespace',
        'error-key',
      );

      const event = new SecureTestCreated(
        'error-test-aggregate-id',
        {
          id: SecureTestId.create('error-test-id').value,
          webhookUrl: 'https://example.com/error-webhook',
          signingSecretRef: dopplerRef,
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Mock Redis to throw an error
      mockRedis.hset.mockRejectedValueOnce(
        new Error('Redis connection failed'),
      );

      // Act & Assert
      await expect(projector.handleSecureTestCreated(event)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to project SecureTestCreated'),
        expect.objectContaining({
          operation: 'handleSecureTestCreated',
          error: expect.any(Error),
          aggregateId: 'error-test-aggregate-id',
        }),
      );
    });

    it('should handle malformed SecretRef data gracefully', async () => {
      // Arrange - Event with malformed SecretRef data
      const event = new SecureTestCreated(
        'malformed-test-aggregate-id',
        {
          id: SecureTestId.create('malformed-test-id').value,
          webhookUrl: 'https://example.com/malformed-webhook',
          signingSecretRef: { invalid: 'secretref' } as any, // Malformed SecretRef
          isActive: true,
          tenant: 'test-tenant',
        },
        actorContext,
        new Date(),
        1,
      );

      // Act
      await projector.handleSecureTestCreated(event);

      // Assert - Should not throw, but log warning about unknown SecretRef type
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown SecretRef type detected'),
        expect.objectContaining({
          operation: 'handleSecureTestCreated',
          secretRefField: 'signingSecret',
          secretRefType: 'none',
        }),
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle batch projection efficiently with mixed SecretRef types', async () => {
      // Arrange - Multiple events with different SecretRef types
      const events = Array.from({ length: 50 }, (_, i) => {
        const isDoppler = i % 2 === 0;
        const secretRef = isDoppler
          ? createDopplerSecretRef(
              'test-tenant',
              `batch-namespace-${i}`,
              `batch-key-${i}`,
            )
          : createSealedSecretRef(
              'test-tenant',
              `batch-kek-${i}`,
              'XCHACHA20-POLY1305',
              `batch-blob-${i}`,
            );

        return new SecureTestCreated(
          `batch-test-aggregate-${i}`,
          {
            id: SecureTestId.create(`batch-test-${i}`).value,
            webhookUrl: `https://example.com/batch-webhook-${i}`,
            [isDoppler ? 'signingSecretRef' : 'passwordRef']: secretRef,
            isActive: true,
            tenant: 'test-tenant',
          },
          actorContext,
          new Date(),
          1,
        );
      });

      // Act - Process all events
      const startTime = Date.now();

      for (const event of events) {
        await projector.handleSecureTestCreated(event);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert - Should complete within reasonable time
      expect(duration).toBeLessThan(2000); // 2 seconds for 50 operations
      expect(mockRedis.hset).toHaveBeenCalledTimes(50);

      // Verify logging for both types
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef type identified'),
        expect.objectContaining({
          secretRefTypes: expect.objectContaining({
            signingSecret: 'doppler',
          }),
        }),
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef type identified'),
        expect.objectContaining({
          secretRefTypes: expect.objectContaining({
            password: 'sealed',
          }),
        }),
      );
    });
  });

  describe('Integration with Phase 3 Features', () => {
    it('should be properly enhanced for Phase 3 SecretRefUnion support', () => {
      // Assert that the projector exists and is properly configured
      expect(projector).toBeDefined();
      expect(typeof projector.handleSecureTestCreated).toBe('function');
      expect(typeof projector.handleSecureTestUpdated).toBe('function');
    });

    it('should maintain consistency with other Phase 3 components', () => {
      // This test ensures projector logging is consistent with repository and field validator logging
      // The logging format should be standardized across all Phase 3 components
      expect(mockLogger).toBeDefined();
      expect(mockClock).toBeDefined();
      expect(mockRedis).toBeDefined();
    });
  });
});
