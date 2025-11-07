import { Test } from '@nestjs/testing';
import { SealedSecretService } from '../infrastructure/sealed-secret.service';
import { EnhancedSecretRefService } from '../infrastructure/enhanced-secret-ref.service';
import { SecretRefService } from '../secret-ref.service';
import { DopplerClient } from '../providers/doppler.client';
import {
  createSealedSecretRef,
  createDopplerSecretRef,
} from '../domain/sealed-secret-ref.types';
import { SUPPORTED_ALGORITHMS } from '../infrastructure/crypto/crypto.constants';

// Mock DopplerClient for testing
const mockDopplerClient = {
  getSecret: jest.fn(),
};

// Mock SecretRefService for testing
const mockSecretRefService = {
  resolve: jest.fn(),
  healthCheck: jest.fn(),
};

describe('Phase 1: Sealed SecretRef Foundation', () => {
  let sealedSecretService: SealedSecretService;
  let enhancedSecretRefService: EnhancedSecretRefService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SealedSecretService,
        EnhancedSecretRefService,
        {
          provide: DopplerClient,
          useValue: mockDopplerClient,
        },
        {
          provide: SecretRefService,
          useValue: mockSecretRefService,
        },
      ],
    }).compile();

    sealedSecretService =
      moduleRef.get<SealedSecretService>(SealedSecretService);
    enhancedSecretRefService = moduleRef.get<EnhancedSecretRefService>(
      EnhancedSecretRefService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Type System', () => {
    it('should create valid Doppler SecretRef', () => {
      const dopplerRef = createDopplerSecretRef(
        'core',
        'notification',
        'slack/signing-secret',
        { version: 'latest' },
      );

      expect(dopplerRef.scheme).toBe('secret');
      expect(dopplerRef.provider).toBe('doppler');
      expect(dopplerRef.tenant).toBe('core');
      expect(dopplerRef.namespace).toBe('notification');
      expect(dopplerRef.key).toBe('slack/signing-secret');
      expect(dopplerRef.version).toBe('latest');
    });

    it('should create valid Sealed SecretRef', () => {
      const sealedRef = createSealedSecretRef(
        'core',
        'TENANT_KEK_CORE_V1',
        SUPPORTED_ALGORITHMS.XCHACHA20_POLY1305,
        'dGVzdC1lbnZlbG9wZQ==', // base64 encoded 'test-envelope'
        { aad: 'notification.slack.signingSecret' },
      );

      expect(sealedRef.scheme).toBe('secret');
      expect(sealedRef.provider).toBe('sealed');
      expect(sealedRef.tenant).toBe('core');
      expect(sealedRef.kekKid).toBe('TENANT_KEK_CORE_V1');
      expect(sealedRef.alg).toBe(SUPPORTED_ALGORITHMS.XCHACHA20_POLY1305);
      expect(sealedRef.aad).toBe('notification.slack.signingSecret');
      expect(sealedRef.v).toBe(1);
    });
  });

  describe('SealedSecretService', () => {
    it('should validate sealed SecretRef correctly', () => {
      const validRef = createSealedSecretRef(
        'core',
        'TENANT_KEK_CORE_V1',
        SUPPORTED_ALGORITHMS.XCHACHA20_POLY1305,
        'dGVzdA==',
      );

      const isValid = sealedSecretService.validateSealedRef(validRef);
      expect(isValid).toBe(true);
    });

    it('should reject invalid sealed SecretRef', () => {
      const invalidRef = {
        scheme: 'secret',
        provider: 'sealed',
        tenant: 'core',
        // Missing required fields
      } as any;

      const isValid = sealedSecretService.validateSealedRef(invalidRef);
      expect(isValid).toBe(false);
    });

    it('should generate tenant KEK identifier', async () => {
      const kekKid = await sealedSecretService.generateTenantKEK('core', 1);
      expect(kekKid).toBe('TENANT_KEK_CORE_V1');
    });

    it('should seal and unseal secrets (mock implementation)', async () => {
      // Mock KEK response from Doppler
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'dGVzdC1rZXktMzItYnl0ZXMtYmFzZTY0LWVuY29kZWQ=', // Mock base64 KEK
        version: 'latest',
        project: 'test',
        config: 'dev',
      });

      const plaintext = 'my-secret-password';
      const tenant = 'core';
      const context = 'notification.slack.password';

      // Seal the secret
      const sealedRef = await sealedSecretService.seal(
        plaintext,
        tenant,
        context,
      );

      expect(sealedRef.provider).toBe('sealed');
      expect(sealedRef.tenant).toBe(tenant);
      expect(sealedRef.aad).toBe(context);
      expect(sealedRef.kekKid).toBe('TENANT_KEK_CORE_V1');

      // Unseal the secret
      const unsealed = await sealedSecretService.unseal(sealedRef);
      expect(unsealed).toBe(plaintext);

      // Verify Doppler was called for KEK
      expect(mockDopplerClient.getSecret).toHaveBeenCalledWith(
        'TENANT_KEK_CORE_V1',
      );
    });
  });

  describe('EnhancedSecretRefService', () => {
    it('should validate both Doppler and Sealed refs', () => {
      const dopplerRef = createDopplerSecretRef('core', 'notification', 'test');
      const sealedRef = createSealedSecretRef(
        'core',
        'KEK_V1',
        'XCHACHA20-POLY1305',
        'dGVzdA==',
      );

      expect(enhancedSecretRefService.validateSecretRef(dopplerRef)).toBe(true);
      expect(enhancedSecretRefService.validateSecretRef(sealedRef)).toBe(true);
    });

    it('should create sealed refs', async () => {
      // Mock KEK response
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'dGVzdC1rZXktMzItYnl0ZXMtYmFzZTY0LWVuY29kZWQ=',
        version: 'latest',
        project: 'test',
        config: 'dev',
      });

      const sealedRef = await enhancedSecretRefService.createSealedRef(
        'test-secret',
        'core',
        'test.context',
      );

      expect(sealedRef.provider).toBe('sealed');
      expect(sealedRef.tenant).toBe('core');
      expect(sealedRef.aad).toBe('test.context');
    });

    it('should perform health check', async () => {
      mockSecretRefService.healthCheck.mockResolvedValue({
        healthy: true,
        latencyMs: 50,
      });

      const health = await enhancedSecretRefService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.doppler.healthy).toBe(true);
      expect(health.sealed.healthy).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should support mixed provider resolution', async () => {
      // Mock responses
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'dGVzdC1rZXktMzItYnl0ZXMtYmFzZTY0LWVuY29kZWQ=',
        version: 'latest',
        project: 'test',
        config: 'dev',
      });

      mockSecretRefService.resolve.mockResolvedValue({
        value: 'doppler-secret-value',
        version: 'latest',
        providerLatencyMs: 100,
      });

      // Create both types of refs
      const dopplerRef = createDopplerSecretRef('core', 'notification', 'test');
      const sealedRef = await enhancedSecretRefService.createSealedRef(
        'sealed-secret-value',
        'core',
        'test',
      );

      // Resolve both
      const dopplerValue =
        await enhancedSecretRefService.resolveSecret(dopplerRef);
      const sealedValue =
        await enhancedSecretRefService.resolveSecret(sealedRef);

      expect(dopplerValue).toBe('doppler-secret-value');
      expect(sealedValue).toBe('sealed-secret-value');
    });
  });
});
