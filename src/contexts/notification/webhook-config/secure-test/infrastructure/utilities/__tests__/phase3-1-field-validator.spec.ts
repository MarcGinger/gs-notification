import {
  createDopplerSecretRef,
  createSealedSecretRef,
  SecretRefUnion,
  isDopplerSecretRef,
  isSealedSecretRef,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';
import { TenantContext } from 'src/shared/domain/tenant/tenant-context.interface';
import { SecureTestFieldValidatorUtil } from '../utilities/secure-test-field-validator.util';
import {
  SecureTestTypeValue,
  SecureTestSignatureAlgorithmValue,
} from '../../application/dtos';

describe('Phase 3.1: SecureTest Field Validator Enhanced', () => {
  describe('SecretRefUnion Support', () => {
    it('should validate Doppler SecretRef', () => {
      const dopplerRef = createDopplerSecretRef('test-doppler-secret');

      const isValid =
        SecureTestFieldValidatorUtil.validateSecretRefUnion(dopplerRef);

      expect(isValid).toBe(true);
      expect(isDopplerSecretRef(dopplerRef)).toBe(true);
      expect(isSealedSecretRef(dopplerRef)).toBe(false);
    });

    it('should validate Sealed SecretRef', () => {
      const tenantContext: TenantContext = {
        tenantId: 'test-tenant',
        metadata: { source: 'test' },
      };

      const sealedRef = createSealedSecretRef(
        'test-sealed-secret',
        'encrypted-blob-content',
        tenantContext,
      );

      const isValid =
        SecureTestFieldValidatorUtil.validateSecretRefUnion(sealedRef);

      expect(isValid).toBe(true);
      expect(isSealedSecretRef(sealedRef)).toBe(true);
      expect(isDopplerSecretRef(sealedRef)).toBe(false);
    });

    it('should reject invalid SecretRefUnion', () => {
      const invalidRef = { invalidField: 'test' } as any;

      const isValid =
        SecureTestFieldValidatorUtil.validateSecretRefUnion(invalidRef);

      expect(isValid).toBe(false);
    });
  });

  describe('Factory Methods with SecretRefUnion', () => {
    const tenantContext: TenantContext = {
      tenantId: 'test-tenant',
      metadata: { source: 'test' },
    };

    it('should create SecureTest snapshot with Doppler SecretRef', () => {
      const dopplerRef = createDopplerSecretRef('doppler-signing-secret');
      const aggregateData = {
        id: 'test-id',
        name: 'Test SecureTest',
        description: 'Test description',
        type: 'hmac' as SecureTestTypeValue,
        signingSecretRef: dopplerRef,
        signatureAlgorithm: 'sha256' as SecureTestSignatureAlgorithmValue,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot =
        SecureTestFieldValidatorUtil.createSecureTestSnapshotFromEventData(
          aggregateData,
        );

      expect(snapshot.id).toBe('test-id');
      expect(snapshot.name).toBe('Test SecureTest');
      expect(snapshot.type).toBe('hmac');
      expect(typeof snapshot.signingSecretRef).toBe('string');

      // Should be serialized as JSON
      const parsedRef = JSON.parse(snapshot.signingSecretRef!);
      expect(isDopplerSecretRef(parsedRef)).toBe(true);
    });

    it('should create SecureTest snapshot with Sealed SecretRef', () => {
      const sealedRef = createSealedSecretRef(
        'sealed-signing-secret',
        'encrypted-blob-content',
        tenantContext,
      );

      const aggregateData = {
        id: 'test-id-sealed',
        name: 'Test Sealed SecureTest',
        type: 'hmac' as SecureTestTypeValue,
        signingSecretRef: sealedRef,
        signatureAlgorithm: 'sha256' as SecureTestSignatureAlgorithmValue,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot =
        SecureTestFieldValidatorUtil.createSecureTestSnapshotFromEventData(
          aggregateData,
        );

      expect(snapshot.id).toBe('test-id-sealed');
      expect(typeof snapshot.signingSecretRef).toBe('string');

      // Should be serialized as JSON
      const parsedRef = JSON.parse(snapshot.signingSecretRef!);
      expect(isSealedSecretRef(parsedRef)).toBe(true);
      expect(parsedRef.encryptedBlob).toBe('encrypted-blob-content');
    });

    it('should create projector data with mixed SecretRef types', () => {
      const dopplerSigningRef = createDopplerSecretRef('doppler-signing');
      const sealedUsernameRef = createSealedSecretRef(
        'sealed-username',
        'encrypted-username-blob',
        tenantContext,
      );
      const dopplerPasswordRef = createDopplerSecretRef('doppler-password');

      const aggregateData = {
        id: 'mixed-test-id',
        name: 'Mixed SecretRef Test',
        type: 'basic' as SecureTestTypeValue,
        signingSecretRef: dopplerSigningRef,
        usernameRef: sealedUsernameRef,
        passwordRef: dopplerPasswordRef,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const projectorData =
        SecureTestFieldValidatorUtil.createSecureTestProjectorDataFromEventData(
          aggregateData,
        );

      expect(projectorData.id).toBe('mixed-test-id');
      expect(projectorData.name).toBe('Mixed SecretRef Test');
      expect(projectorData.type).toBe('basic');

      // All SecretRefs should be serialized as JSON strings
      expect(typeof projectorData.signingSecret).toBe('string');
      expect(typeof projectorData.username).toBe('string');
      expect(typeof projectorData.password).toBe('string');

      // Parse and verify types
      const signingRef = JSON.parse(projectorData.signingSecret!);
      const usernameRef = JSON.parse(projectorData.username!);
      const passwordRef = JSON.parse(projectorData.password!);

      expect(isDopplerSecretRef(signingRef)).toBe(true);
      expect(isSealedSecretRef(usernameRef)).toBe(true);
      expect(isDopplerSecretRef(passwordRef)).toBe(true);

      // Verify encrypted content is preserved
      expect(usernameRef.encryptedBlob).toBe('encrypted-username-blob');
    });
  });

  describe('Legacy Migration Support', () => {
    it('should handle legacy SecretRef format', () => {
      const legacySecretRef = { secretId: 'legacy-secret' };
      const aggregateData = {
        id: 'legacy-test-id',
        name: 'Legacy Test',
        type: 'hmac' as SecureTestTypeValue,
        signingSecretRef: legacySecretRef,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot =
        SecureTestFieldValidatorUtil.createSecureTestSnapshotFromEventData(
          aggregateData,
        );

      expect(snapshot.id).toBe('legacy-test-id');
      expect(typeof snapshot.signingSecretRef).toBe('string');

      const parsedRef = JSON.parse(snapshot.signingSecretRef!);
      expect(parsedRef.secretId).toBe('legacy-secret');
    });

    it('should create projector data from legacy format', () => {
      const legacyUsernameRef = { secretId: 'legacy-username' };
      const aggregateData = {
        id: 'legacy-projector-test',
        name: 'Legacy Projector Test',
        type: 'basic' as SecureTestTypeValue,
        usernameRef: legacyUsernameRef,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const projectorData =
        SecureTestFieldValidatorUtil.createSecureTestProjectorDataFromEventData(
          aggregateData,
        );

      expect(projectorData.id).toBe('legacy-projector-test');
      expect(typeof projectorData.username).toBe('string');

      const parsedRef = JSON.parse(projectorData.username!);
      expect(parsedRef.secretId).toBe('legacy-username');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', () => {
      const invalidData = {
        // Missing id and name
        type: 'hmac' as SecureTestTypeValue,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => {
        SecureTestFieldValidatorUtil.createSecureTestSnapshotFromEventData(
          invalidData as any,
        );
      }).toThrow();
    });

    it('should handle invalid SecretRef objects gracefully', () => {
      const invalidRef = null;
      const aggregateData = {
        id: 'error-test-id',
        name: 'Error Test',
        type: 'hmac' as SecureTestTypeValue,
        signingSecretRef: invalidRef,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot =
        SecureTestFieldValidatorUtil.createSecureTestSnapshotFromEventData(
          aggregateData,
        );

      expect(snapshot.id).toBe('error-test-id');
      expect(snapshot.signingSecretRef).toBeUndefined();
    });
  });

  describe('JSON Serialization Consistency', () => {
    it('should produce consistent JSON serialization', () => {
      const tenantContext: TenantContext = {
        tenantId: 'consistency-tenant',
        metadata: { source: 'test' },
      };

      const sealedRef = createSealedSecretRef(
        'consistent-secret',
        'consistent-encrypted-blob',
        tenantContext,
      );

      // Serialize multiple times and ensure consistency
      const json1 = JSON.stringify(sealedRef);
      const json2 = JSON.stringify(sealedRef);

      expect(json1).toBe(json2);

      // Parse and re-serialize should be identical
      const parsed = JSON.parse(json1);
      const json3 = JSON.stringify(parsed);

      expect(json1).toBe(json3);
    });

    it('should handle round-trip serialization for mixed types', () => {
      const dopplerRef = createDopplerSecretRef('roundtrip-doppler');
      const tenantContext: TenantContext = {
        tenantId: 'roundtrip-tenant',
        metadata: { source: 'test' },
      };
      const sealedRef = createSealedSecretRef(
        'roundtrip-sealed',
        'roundtrip-encrypted-blob',
        tenantContext,
      );

      const aggregateData = {
        id: 'roundtrip-test',
        name: 'Roundtrip Test',
        type: 'basic' as SecureTestTypeValue,
        usernameRef: dopplerRef,
        passwordRef: sealedRef,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create projector data (this serializes to JSON)
      const projectorData =
        SecureTestFieldValidatorUtil.createSecureTestProjectorDataFromEventData(
          aggregateData,
        );

      // Parse back the JSON
      const parsedUsername = JSON.parse(projectorData.username!);
      const parsedPassword = JSON.parse(projectorData.password!);

      // Verify types are preserved
      expect(isDopplerSecretRef(parsedUsername)).toBe(true);
      expect(isSealedSecretRef(parsedPassword)).toBe(true);

      // Verify content is preserved
      expect(parsedUsername.secretId).toBe('roundtrip-doppler');
      expect(parsedPassword.secretId).toBe('roundtrip-sealed');
      expect(parsedPassword.encryptedBlob).toBe('roundtrip-encrypted-blob');
      expect(parsedPassword.tenantContext.tenantId).toBe('roundtrip-tenant');
    });
  });
});
