import { Test } from '@nestjs/testing';
import { SecureTestWriterRepository } from '../secure-test-kurrentdb-writer.repository';
import { SecretRefService } from 'src/shared/infrastructure/secret-ref/secret-ref.service';
import { APP_LOGGER } from 'src/shared/logging';
import { Clock, CLOCK } from 'src/shared/infrastructure/time';
import { SecureTestAggregate } from '../../../domain/aggregates/secure-test.aggregate';
import {
  createDopplerSecretRef,
  createSealedSecretRef,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';

// Mock EventStoreClient
const mockEventStoreClient = {
  appendToStream: jest.fn(),
  readStream: jest.fn(),
  subscribeToStream: jest.fn(),
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

describe('Phase 3.3: Writer Repository SecretRefUnion Support', () => {
  let writerRepository: SecureTestWriterRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecureTestWriterRepository,
        {
          provide: 'EventStoreClient',
          useValue: mockEventStoreClient,
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

    writerRepository = moduleRef.get<SecureTestWriterRepository>(
      SecureTestWriterRepository,
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('SecretRef Type Inspection', () => {
    it('should inspect aggregate with Doppler SecretRef correctly', () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'test-namespace',
        'test-key',
      );

      // Create a mock aggregate with Doppler SecretRef
      const mockAggregate = {
        props: {
          signingSecretRef: dopplerRef,
          id: 'test-id',
        },
      } as unknown as SecureTestAggregate;

      // Act - Access private method through type assertion for testing
      const inspection = (
        writerRepository as any
      ).inspectAggregateSecretRefTypes(mockAggregate);

      // Assert
      expect(inspection.hasSecretRefs).toBe(true);
      expect(inspection.secretRefTypes.signingSecret).toBe('doppler');
      expect(inspection.hasSealedSecrets).toBe(false);
    });

    it('should inspect aggregate with Sealed SecretRef correctly', () => {
      // Arrange
      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'test-kek-kid',
        'XCHACHA20-POLY1305',
        'encrypted-blob',
      );

      // Create a mock aggregate with Sealed SecretRef
      const mockAggregate = {
        props: {
          passwordRef: sealedRef,
          id: 'test-id',
        },
      } as unknown as SecureTestAggregate;

      // Act - Access private method through type assertion for testing
      const inspection = (
        writerRepository as any
      ).inspectAggregateSecretRefTypes(mockAggregate);

      // Assert
      expect(inspection.hasSecretRefs).toBe(true);
      expect(inspection.secretRefTypes.password).toBe('sealed');
      expect(inspection.hasSealedSecrets).toBe(true);
    });

    it('should inspect aggregate with mixed SecretRef types', () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'signing-namespace',
        'signing-key',
      );

      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'creds-kek',
        'AES-256-GCM',
        'sealed-username-blob',
      );

      // Create a mock aggregate with mixed SecretRef types
      const mockAggregate = {
        props: {
          signingSecretRef: dopplerRef,
          usernameRef: sealedRef,
          id: 'mixed-test-id',
        },
      } as unknown as SecureTestAggregate;

      // Act - Access private method through type assertion for testing
      const inspection = (
        writerRepository as any
      ).inspectAggregateSecretRefTypes(mockAggregate);

      // Assert
      expect(inspection.hasSecretRefs).toBe(true);
      expect(inspection.secretRefTypes.signingSecret).toBe('doppler');
      expect(inspection.secretRefTypes.username).toBe('sealed');
      expect(inspection.hasSealedSecrets).toBe(true);
    });

    it('should handle aggregate with no SecretRefs', () => {
      // Arrange - Mock aggregate without SecretRefs
      const mockAggregate = {
        props: {
          id: 'no-secrets-test-id',
          webhookUrl: 'https://example.com/webhook',
        },
      } as unknown as SecureTestAggregate;

      // Act - Access private method through type assertion for testing
      const inspection = (
        writerRepository as any
      ).inspectAggregateSecretRefTypes(mockAggregate);

      // Assert
      expect(inspection.hasSecretRefs).toBe(false);
      expect(inspection.secretRefTypes).toEqual({});
      expect(inspection.hasSealedSecrets).toBe(false);
    });

    it('should handle inspection errors gracefully', () => {
      // Arrange - Malformed aggregate that will cause inspection to fail
      const malformedAggregate = null as unknown as SecureTestAggregate;

      // Act - Access private method through type assertion for testing
      const inspection = (
        writerRepository as any
      ).inspectAggregateSecretRefTypes(malformedAggregate);

      // Assert - Should return safe defaults on error
      expect(inspection.hasSecretRefs).toBe(false);
      expect(inspection.secretRefTypes).toEqual({});
      expect(inspection.hasSealedSecrets).toBe(false);
    });
  });

  describe('SecretRef Type Detection', () => {
    it('should correctly identify Doppler SecretRef', () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'test-namespace',
        'test-key',
      );

      // Act - Access private method through type assertion for testing
      const refType = (writerRepository as any).getSecretRefType(dopplerRef);

      // Assert
      expect(refType).toBe('doppler');
    });

    it('should correctly identify Sealed SecretRef', () => {
      // Arrange
      const sealedRef = createSealedSecretRef(
        'test-tenant',
        'test-kek-kid',
        'XCHACHA20-POLY1305',
        'test-blob',
      );

      // Act - Access private method through type assertion for testing
      const refType = (writerRepository as any).getSecretRefType(sealedRef);

      // Assert
      expect(refType).toBe('sealed');
    });

    it('should handle JSON string SecretRefs', () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'test-tenant',
        'test-namespace',
        'test-key',
      );
      const jsonString = JSON.stringify(dopplerRef);

      // Act - Access private method through type assertion for testing
      const refType = (writerRepository as any).getSecretRefType(jsonString);

      // Assert
      expect(refType).toBe('doppler');
    });

    it('should return none for invalid SecretRef', () => {
      // Arrange
      const invalidRef = { invalid: 'data' };

      // Act - Access private method through type assertion for testing
      const refType = (writerRepository as any).getSecretRefType(invalidRef);

      // Assert
      expect(refType).toBe('none');
    });

    it('should return none for null/undefined', () => {
      // Act & Assert
      expect((writerRepository as any).getSecretRefType(null)).toBe('none');
      expect((writerRepository as any).getSecretRefType(undefined)).toBe(
        'none',
      );
    });
  });

  describe('Integration with Phase 3 Features', () => {
    it('should be properly enhanced for Phase 3 SecretRefUnion support', () => {
      // Assert that the Phase 3 enhancement methods exist
      expect(
        typeof (writerRepository as any).inspectAggregateSecretRefTypes,
      ).toBe('function');
      expect(typeof (writerRepository as any).getSecretRefType).toBe(
        'function',
      );
    });

    it('should maintain backward compatibility', () => {
      // Arrange - Legacy style SecretRef data
      const legacyRef = {
        secretId: 'legacy-secret',
        provider: 'doppler',
      };

      // Act - Access private method through type assertion for testing
      const refType = (writerRepository as any).getSecretRefType(legacyRef);

      // Assert
      expect(refType).toBe('legacy');
    });
  });
});
