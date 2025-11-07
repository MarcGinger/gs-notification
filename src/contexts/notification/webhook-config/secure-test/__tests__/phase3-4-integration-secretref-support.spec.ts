import { Test } from '@nestjs/testing';
import { APP_LOGGER } from 'src/shared/logging';
import { Clock, CLOCK } from 'src/shared/infrastructure/time';
import { SecureTestFieldValidatorUtil } from '../infrastructure/utilities/secure-test-field-validator.util';
import {
  createDopplerSecretRef,
  createSealedSecretRef,
  SecretRefUnion,
  DopplerSecretRef,
  SealedSecretRef,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';
import { ActorContext } from 'src/shared/application/context';

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

describe('Phase 3.4: Integration Tests - SecretRefUnion Support', () => {
  let fieldValidator: SecureTestFieldValidatorUtil;
  let actorContext: ActorContext;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecureTestFieldValidatorUtil,
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

    fieldValidator = moduleRef.get<SecureTestFieldValidatorUtil>(
      SecureTestFieldValidatorUtil,
    );

    actorContext = {
      userId: 'integration-test-user',
      tenant: 'integration-test-tenant',
      tenant_userId: 'integration-test-tenant-user',
      roles: ['user', 'admin'],
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('End-to-End SecretRefUnion Validation and Processing', () => {
    it('should validate and process Doppler SecretRef end-to-end', () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'integration-tenant',
        'integration-namespace',
        'integration-signing-secret',
        {
          version: '1.0.0',
          algHint: 'HMAC-SHA256',
          checksum: 'abc123def456',
        },
      );

      const testData = {
        id: 'integration-test-1',
        webhookUrl: 'https://integration.example.com/webhook',
        signingSecretRef: dopplerRef,
        isActive: true,
        tenant: 'integration-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert
      expect(validationResult.isOk()).toBe(true);
      if (validationResult.isOk()) {
        const validatedData = validationResult.value;
        expect(validatedData.signingSecretRef).toEqual(dopplerRef);
        expect(validatedData.id).toBe('integration-test-1');
        expect(validatedData.webhookUrl).toBe(
          'https://integration.example.com/webhook',
        );
      }

      // Verify logging
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef validation completed'),
        expect.objectContaining({
          operation: 'validateSecureTestProjectorData',
          secretRefTypes: expect.objectContaining({
            signingSecret: 'doppler',
          }),
          hasSealedSecrets: false,
        }),
      );
    });

    it('should validate and process Sealed SecretRef end-to-end', () => {
      // Arrange
      const sealedRef = createSealedSecretRef(
        'integration-tenant',
        'integration-kek-kid',
        'AES-256-GCM',
        'encrypted-integration-password-blob',
        {
          aad: 'additional-auth-data',
          v: 2,
        },
      );

      const testData = {
        id: 'integration-test-2',
        webhookUrl: 'https://integration.example.com/sealed-webhook',
        passwordRef: sealedRef,
        isActive: true,
        tenant: 'integration-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert
      expect(validationResult.isOk()).toBe(true);
      if (validationResult.isOk()) {
        const validatedData = validationResult.value;
        expect(validatedData.passwordRef).toEqual(sealedRef);
        expect(validatedData.id).toBe('integration-test-2');
        expect(validatedData.webhookUrl).toBe(
          'https://integration.example.com/sealed-webhook',
        );
      }

      // Verify logging
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef validation completed'),
        expect.objectContaining({
          operation: 'validateSecureTestProjectorData',
          secretRefTypes: expect.objectContaining({
            password: 'sealed',
          }),
          hasSealedSecrets: true,
        }),
      );
    });

    it('should validate and process mixed SecretRef types end-to-end', () => {
      // Arrange
      const dopplerRef = createDopplerSecretRef(
        'integration-tenant',
        'mixed-signing-namespace',
        'mixed-signing-key',
      );

      const sealedRef = createSealedSecretRef(
        'integration-tenant',
        'mixed-creds-kek',
        'XCHACHA20-POLY1305',
        'mixed-username-blob',
      );

      const testData = {
        id: 'integration-test-mixed',
        webhookUrl: 'https://integration.example.com/mixed-webhook',
        signingSecretRef: dopplerRef,
        usernameRef: sealedRef,
        isActive: true,
        tenant: 'integration-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert
      expect(validationResult.isOk()).toBe(true);
      if (validationResult.isOk()) {
        const validatedData = validationResult.value;
        expect(validatedData.signingSecretRef).toEqual(dopplerRef);
        expect(validatedData.usernameRef).toEqual(sealedRef);
        expect(validatedData.id).toBe('integration-test-mixed');
      }

      // Verify comprehensive logging
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef validation completed'),
        expect.objectContaining({
          operation: 'validateSecureTestProjectorData',
          secretRefTypes: expect.objectContaining({
            signingSecret: 'doppler',
            username: 'sealed',
          }),
          hasSealedSecrets: true,
        }),
      );
    });
  });

  describe('SecretRef Serialization and Deserialization', () => {
    it('should handle JSON round-trip for Doppler SecretRef', () => {
      // Arrange
      const originalRef = createDopplerSecretRef(
        'roundtrip-tenant',
        'roundtrip-namespace',
        'roundtrip-key',
      );

      // Act - Serialize to JSON and deserialize
      const jsonString = JSON.stringify(originalRef);
      const deserializedRef = JSON.parse(jsonString) as DopplerSecretRef;

      const testData = {
        id: 'roundtrip-test',
        webhookUrl: 'https://roundtrip.example.com/webhook',
        signingSecretRef: deserializedRef,
        isActive: true,
        tenant: 'roundtrip-tenant',
      };

      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert
      expect(validationResult.isOk()).toBe(true);
      expect(deserializedRef).toEqual(originalRef);
    });

    it('should handle JSON round-trip for Sealed SecretRef', () => {
      // Arrange
      const originalRef = createSealedSecretRef(
        'roundtrip-tenant',
        'roundtrip-kek',
        'AES-256-GCM',
        'roundtrip-blob',
      );

      // Act - Serialize to JSON and deserialize
      const jsonString = JSON.stringify(originalRef);
      const deserializedRef = JSON.parse(jsonString) as SealedSecretRef;

      const testData = {
        id: 'roundtrip-sealed-test',
        webhookUrl: 'https://roundtrip.example.com/sealed-webhook',
        passwordRef: deserializedRef,
        isActive: true,
        tenant: 'roundtrip-tenant',
      };

      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert
      expect(validationResult.isOk()).toBe(true);
      expect(deserializedRef).toEqual(originalRef);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle validation errors gracefully', () => {
      // Arrange - Invalid data that should fail validation
      const testData = {
        id: '', // Invalid empty ID
        webhookUrl: 'invalid-url', // Invalid URL format
        signingSecretRef: { invalid: 'secretref' } as any, // Malformed SecretRef
        isActive: true,
        tenant: 'integration-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert
      expect(validationResult.isErr()).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef validation failed'),
        expect.objectContaining({
          operation: 'validateSecureTestProjectorData',
          error: expect.any(Object),
        }),
      );
    });

    it('should handle missing required fields', () => {
      // Arrange - Data missing required fields
      const testData = {
        // Missing id
        webhookUrl: 'https://missing-fields.example.com/webhook',
        isActive: true,
        tenant: 'integration-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData as any,
        actorContext,
      );

      // Assert
      expect(validationResult.isErr()).toBe(true);
    });

    it('should handle null and undefined SecretRef values', () => {
      // Arrange
      const testData = {
        id: 'null-test',
        webhookUrl: 'https://null-test.example.com/webhook',
        signingSecretRef: null,
        usernameRef: undefined,
        isActive: true,
        tenant: 'integration-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData as any,
        actorContext,
      );

      // Assert - Should still validate if other fields are correct
      expect(validationResult.isOk()).toBe(true);
      if (validationResult.isOk()) {
        const validatedData = validationResult.value;
        expect(validatedData.signingSecretRef).toBeNull();
        expect(validatedData.usernameRef).toBeUndefined();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle validation of large datasets efficiently', () => {
      // Arrange - Create multiple test data sets
      const testDataSets = Array.from({ length: 100 }, (_, i) => {
        const isDoppler = i % 2 === 0;
        const secretRef = isDoppler
          ? createDopplerSecretRef(
              'perf-tenant',
              `perf-namespace-${i}`,
              `perf-key-${i}`,
            )
          : createSealedSecretRef(
              'perf-tenant',
              `perf-kek-${i}`,
              'XCHACHA20-POLY1305',
              `perf-blob-${i}`,
            );

        return {
          id: `perf-test-${i}`,
          webhookUrl: `https://perf.example.com/webhook-${i}`,
          [isDoppler ? 'signingSecretRef' : 'passwordRef']: secretRef,
          isActive: true,
          tenant: 'perf-tenant',
        };
      });

      // Act - Validate all datasets
      const startTime = Date.now();

      const results = testDataSets.map((testData) =>
        fieldValidator.validateSecureTestProjectorData(testData, actorContext),
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert - All should validate successfully and complete within reasonable time
      expect(results.every((result) => result.isOk())).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // Verify logging occurred for both types
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef validation completed'),
        expect.objectContaining({
          secretRefTypes: expect.objectContaining({
            signingSecret: 'doppler',
          }),
        }),
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('SecretRef validation completed'),
        expect.objectContaining({
          secretRefTypes: expect.objectContaining({
            password: 'sealed',
          }),
        }),
      );
    });
  });

  describe('Phase 3 Feature Integration', () => {
    it('should demonstrate complete Phase 3 SecretRefUnion support', () => {
      // This test validates that all Phase 3 enhancements work together

      // Arrange - Create test data with various SecretRef configurations
      const testCases = [
        {
          name: 'Doppler only',
          data: {
            id: 'phase3-doppler',
            webhookUrl: 'https://phase3.example.com/doppler',
            signingSecretRef: createDopplerSecretRef(
              'phase3',
              'doppler',
              'key',
            ),
            isActive: true,
            tenant: 'phase3-tenant',
          },
        },
        {
          name: 'Sealed only',
          data: {
            id: 'phase3-sealed',
            webhookUrl: 'https://phase3.example.com/sealed',
            passwordRef: createSealedSecretRef(
              'phase3',
              'sealed-kek',
              'AES-256-GCM',
              'blob',
            ),
            isActive: true,
            tenant: 'phase3-tenant',
          },
        },
        {
          name: 'Mixed types',
          data: {
            id: 'phase3-mixed',
            webhookUrl: 'https://phase3.example.com/mixed',
            signingSecretRef: createDopplerSecretRef(
              'phase3',
              'mixed-doppler',
              'signing',
            ),
            usernameRef: createSealedSecretRef(
              'phase3',
              'mixed-kek',
              'XCHACHA20-POLY1305',
              'username',
            ),
            passwordRef: createSealedSecretRef(
              'phase3',
              'mixed-kek',
              'AES-256-GCM',
              'password',
            ),
            isActive: true,
            tenant: 'phase3-tenant',
          },
        },
      ];

      // Act & Assert - Validate each test case
      testCases.forEach((testCase) => {
        const result = fieldValidator.validateSecureTestProjectorData(
          testCase.data,
          actorContext,
        );

        expect(result.isOk()).toBe(true);

        // Verify appropriate logging occurred
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('SecretRef validation completed'),
          expect.objectContaining({
            operation: 'validateSecureTestProjectorData',
            testCase: testCase.name,
          }),
        );
      });
    });

    it('should maintain backward compatibility with legacy SecretRef formats', () => {
      // Arrange - Legacy format SecretRef
      const legacySecretRefData = {
        secretId: 'legacy-secret-id',
        provider: 'doppler',
        // Missing new SecretRefUnion fields
      };

      const testData = {
        id: 'legacy-compat-test',
        webhookUrl: 'https://legacy.example.com/webhook',
        signingSecretRef: legacySecretRefData as any,
        isActive: true,
        tenant: 'legacy-tenant',
      };

      // Act
      const validationResult = fieldValidator.validateSecureTestProjectorData(
        testData,
        actorContext,
      );

      // Assert - Should handle legacy format gracefully
      // The exact behavior depends on implementation - either convert or warn
      expect(mockLogger.warn || mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('legacy'),
        expect.any(Object),
      );
    });
  });
});
