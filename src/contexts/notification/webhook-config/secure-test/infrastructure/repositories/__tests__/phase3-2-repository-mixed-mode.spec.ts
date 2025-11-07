import { Test } from '@nestjs/testing';
import {
  createDopplerSecretRef,
  createSealedSecretRef,
  isDopplerSecretRef,
  isSealedSecretRef,
  SecretRefUnion,
  DopplerSecretRef,
  SealedSecretRef,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';
import { SecretRefService } from 'src/shared/infrastructure/secret-ref/secret-ref.service';
import { ActorContext } from 'src/shared/application/context';
import { SecureTestReaderRepository } from '../secure-test-redis-reader.repository';
import { SecureTestQueryRepository } from '../secure-test-redis-query.repository';
import { APP_LOGGER } from 'src/shared/logging';
import { Clock, CLOCK } from 'src/shared/infrastructure/time';

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  hgetall: jest.fn(),
  exists: jest.fn(),
  pipeline: jest.fn(() => ({
    exec: jest.fn(),
  })),
};

// Mock SecretRefService
const mockSecretRefService = {
  resolve: jest.fn(),
  healthCheck: jest.fn(),
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

describe('Phase 3.2: Repository Mixed-Mode SecretRef Support', () => {
  let readerRepository: SecureTestReaderRepository;
  let queryRepository: SecureTestQueryRepository;
  let actorContext: ActorContext;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecureTestReaderRepository,
        SecureTestQueryRepository,
        {
          provide: 'IORedis',
          useValue: mockRedis,
        },
        {
          provide: SecretRefService,
          useValue: mockSecretRefService,
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

    readerRepository = moduleRef.get<SecureTestReaderRepository>(
      SecureTestReaderRepository,
    );
    queryRepository = moduleRef.get<SecureTestQueryRepository>(
      SecureTestQueryRepository,
    );

    actorContext = {
      userId: 'test-user',
      tenant: 'test-tenant',
      tenant_userId: 'test-tenant-user',
      roles: ['user'],
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('SecretRef Resolution and Conversion', () => {
    it('should resolve Doppler SecretRef correctly', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'test-namespace',
        'test-doppler-secret',
      );

      const mockData = {
        signingSecretRef: JSON.stringify(dopplerRef),
      };

      mockRedis.hgetall.mockResolvedValue(mockData);
      mockSecretRefService.resolve.mockResolvedValue('resolved-secret-value');

      // Act
      const result = await readerRepository.findById('test-id', actorContext);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(mockSecretRefService.resolve).toHaveBeenCalledWith(
          dopplerRef,
          actorContext,
        );
      }
    });

    it('should handle Sealed SecretRef correctly', async () => {
      // Arrange
      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'test-kek-kid',
        'XCHACHA20-POLY1305',
        'encrypted-blob-data',
      );

      const mockData = {
        usernameRef: JSON.stringify(sealedRef),
      };

      mockRedis.hgetall.mockResolvedValue(mockData);
      mockSecretRefService.resolve.mockResolvedValue('decrypted-username');

      // Act
      const result = await readerRepository.findByIdWithSecretRefResolution(
        'test-id',
        actorContext,
      );

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(mockSecretRefService.resolve).toHaveBeenCalledWith(
          sealedRef,
          actorContext,
        );
      }
    });

    it('should handle mixed SecretRef types in single aggregate', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'webhook-namespace',
        'signing-secret',
      );

      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'user-creds-kek',
        'AES-256-GCM',
        'sealed-password-blob',
      );

      const mockData = {
        signingSecretRef: JSON.stringify(dopplerRef),
        passwordRef: JSON.stringify(sealedRef),
      };

      mockRedis.hgetall.mockResolvedValue(mockData);
      mockSecretRefService.resolve
        .mockResolvedValueOnce('doppler-signing-secret')
        .mockResolvedValueOnce('sealed-password');

      // Act
      const result = await readerRepository.findByIdWithSecretRefResolution(
        'mixed-test-id',
        actorContext,
      );

      // Assert
      expect(result.isOk()).toBe(true);
      expect(mockSecretRefService.resolve).toHaveBeenCalledTimes(2);
      expect(mockSecretRefService.resolve).toHaveBeenNthCalledWith(
        1,
        dopplerRef,
        actorContext,
      );
      expect(mockSecretRefService.resolve).toHaveBeenNthCalledWith(
        2,
        sealedRef,
        actorContext,
      );
    });
  });

  describe('Query Repository SecretRef Support', () => {
    it('should handle SecretRef conversion in query operations', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'query-namespace',
        'query-secret',
      );

      const mockQueryResult = {
        id: 'query-test-id',
        signingSecretRef: JSON.stringify(dopplerRef),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockQueryResult));

      // Act
      const result = await queryRepository.findSecureTestsByTenant(
        'test-tenant',
        actorContext,
      );

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const data = result.value;
        expect(data).toBeDefined();
        // Verify that SecretRef data is preserved in correct format
        expect(data.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle SecretRef resolution failures gracefully', async () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'failing-namespace',
        'failing-secret',
      );

      const mockData = {
        signingSecretRef: JSON.stringify(dopplerRef),
      };

      mockRedis.hgetall.mockResolvedValue(mockData);
      mockSecretRefService.resolve.mockRejectedValue(
        new Error('Secret resolution failed'),
      );

      // Act
      const result = await readerRepository.findByIdWithSecretRefResolution(
        'failing-test-id',
        actorContext,
      );

      // Assert - Should handle error gracefully
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Secret resolution failed');
      }
    });

    it('should perform efficiently with multiple SecretRef types', async () => {
      // Arrange
      const testCases = Array.from({ length: 10 }, (_, i) => ({
        id: `perf-test-${i}`,
        dopplerRef: createDopplerSecretRef(
          'test-tenant',
          'perf-namespace',
          `perf-secret-${i}`,
        ),
        sealedRef: createSealedSecretRef(
          'test-tenant',
          'perf-kek',
          'XCHACHA20-POLY1305',
          `perf-blob-${i}`,
        ),
      }));

      // Mock multiple successful resolutions
      mockSecretRefService.resolve.mockResolvedValue('resolved-value');

      // Act & Assert - Measure performance
      const startTime = Date.now();

      for (const testCase of testCases) {
        const mockData = {
          signingSecretRef: JSON.stringify(testCase.dopplerRef),
          passwordRef: JSON.stringify(testCase.sealedRef),
        };

        mockRedis.hgetall.mockResolvedValue(mockData);

        const result = await readerRepository.findByIdWithSecretRefResolution(
          testCase.id,
          actorContext,
        );

        expect(result.isOk()).toBe(true);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 10 operations
    });
  });

  describe('Type Safety and Validation', () => {
    it('should properly validate Doppler SecretRef structure', () => {
      // Arrange
      const validDoppler = createDopplerSecretRef(
        'test-tenant',
        'test-namespace',
        'test-key',
      );

      const invalidDoppler = {
        scheme: 'secret',
        provider: 'doppler',
        // Missing required fields
      };

      // Act & Assert
      expect(isDopplerSecretRef(validDoppler)).toBe(true);
      expect(isDopplerSecretRef(invalidDoppler)).toBe(false);
    });

    it('should properly validate Sealed SecretRef structure', () => {
      // Arrange
      const validSealed = createSealedSecretRef(
        'test-tenant',
        'test-kek-kid',
        'XCHACHA20-POLY1305',
        'test-blob',
      );

      const invalidSealed = {
        scheme: 'secret',
        provider: 'sealed',
        // Missing required fields
      };

      // Act & Assert
      expect(isSealedSecretRef(validSealed)).toBe(true);
      expect(isSealedSecretRef(invalidSealed)).toBe(false);
    });
  });
});
