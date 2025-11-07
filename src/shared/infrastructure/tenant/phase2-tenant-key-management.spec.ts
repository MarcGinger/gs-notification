import { Test, TestingModule } from '@nestjs/testing';
import { createTenantContext, getTenantKekId } from 'src/shared/domain/tenant';
import {
  SecretRefSealedEvent,
  SecretRefUnsealedEvent,
  KekRotationEvent,
} from 'src/shared/domain/events';
import { TenantResolverService } from './tenant-resolver.service';
import { KekManagementService } from './kek-management.service';
import { DopplerClient } from '../secret-ref/providers/doppler.client';
import { Request } from 'express';

describe('Phase 2: Tenant Key Management', () => {
  let tenantResolverService: TenantResolverService;
  let kekManagementService: KekManagementService;
  let dopplerClient: DopplerClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantResolverService,
        KekManagementService,
        {
          provide: DopplerClient,
          useValue: {
            getSecret: jest.fn(),
          },
        },
      ],
    }).compile();

    tenantResolverService = module.get<TenantResolverService>(
      TenantResolverService,
    );
    kekManagementService =
      module.get<KekManagementService>(KekManagementService);
    dopplerClient = module.get<DopplerClient>(DopplerClient);
  });

  describe('2.1 Tenant Context Domain Events', () => {
    it('should create SecretRefSealedEvent with tenant context', () => {
      const tenantContext = createTenantContext('test-tenant');
      const payload = {
        fieldContext: 'notification.slack.signingSecret',
        algorithm: 'XCHACHA20-POLY1305',
        kekId: 'TENANT_KEK_TEST_TENANT_V1',
        blobSize: 128,
        aad: 'notification.slack.signingSecret',
      };

      const event = SecretRefSealedEvent.create(payload, tenantContext);

      expect(event.eventType).toBe('SecretRefSealed.v1');
      expect(event.eventVersion).toBe('v1');
      expect(event.tenantContext).toEqual(tenantContext);
      expect(event.payload).toEqual(payload);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should create SecretRefUnsealedEvent with tenant context', () => {
      const tenantContext = createTenantContext('test-tenant');
      const payload = {
        fieldContext: 'notification.slack.token',
        kekId: 'TENANT_KEK_TEST_TENANT_V1',
        success: true,
      };

      const event = SecretRefUnsealedEvent.create(payload, tenantContext);

      expect(event.eventType).toBe('SecretRefUnsealed.v1');
      expect(event.eventVersion).toBe('v1');
      expect(event.tenantContext).toEqual(tenantContext);
      expect(event.payload).toEqual(payload);
    });

    it('should create KekRotationEvent with tenant context', () => {
      const tenantContext = createTenantContext('test-tenant');
      const payload = {
        oldKekId: 'TENANT_KEK_TEST_TENANT_V1',
        newKekId: 'TENANT_KEK_TEST_TENANT_V2',
        rotationReason: 'scheduled' as const,
        affectedSecretsCount: 5,
      };

      const event = KekRotationEvent.create(payload, tenantContext);

      expect(event.eventType).toBe('KekRotation.v1');
      expect(event.eventVersion).toBe('v1');
      expect(event.tenantContext).toEqual(tenantContext);
      expect(event.payload).toEqual(payload);
    });

    it('should handle tenant context validation in events', () => {
      expect(() => {
        createTenantContext('');
      }).toThrow('TenantContext.tenantId is required');

      expect(() => {
        createTenantContext('invalid@tenant!');
      }).toThrow(
        'TenantContext.tenantId must contain only alphanumeric characters, hyphens, and underscores',
      );

      expect(() => {
        createTenantContext('a'.repeat(51));
      }).toThrow('TenantContext.tenantId must be 50 characters or less');
    });
  });

  describe('2.2 Tenant Resolver Service', () => {
    it('should resolve tenant from X-Tenant-ID header', () => {
      const mockRequest = {
        headers: {
          'x-tenant-id': 'enterprise-client',
          'x-organization-id': 'org-789',
          'x-tenant-tier': 'enterprise',
          'x-region': 'eu-west-1',
        },
        ip: '10.0.0.1',
      } as unknown as Request;

      const result =
        tenantResolverService.resolveTenantFromRequest(mockRequest);

      expect(result.tenantId).toBe('enterprise-client');
      expect(result.organizationId).toBe('org-789');
      expect(result.tenantTier).toBe('enterprise');
      expect(result.region).toBe('eu-west-1');
    });

    it('should resolve tenant from subdomain', () => {
      const mockRequest = {
        headers: {
          host: 'customer-a.gs.com',
        },
      } as unknown as Request;

      const result =
        tenantResolverService.resolveTenantFromRequest(mockRequest);

      expect(result.tenantId).toBe('customer-a');
      expect(result.metadata?.resolveStrategy).toBe('subdomain');
      expect(result.metadata?.originalHost).toBe('customer-a.gs.com');
    });

    it('should fallback to core tenant when no context available', () => {
      const mockRequest = {
        headers: {},
      } as unknown as Request;

      const result =
        tenantResolverService.resolveTenantFromRequest(mockRequest);

      expect(result.tenantId).toBe('core');
      expect(result.tenantName).toBe('Core System');
      expect(result.tenantTier).toBe('enterprise');
      expect(result.metadata?.isDefault).toBe(true);
    });

    it('should resolve tenant from service context', () => {
      const result = tenantResolverService.resolveTenantFromServiceContext(
        'api-tenant',
        {
          serviceId: 'notification-api',
          version: '2.1.0',
        },
      );

      expect(result.tenantId).toBe('api-tenant');
      expect(result.metadata?.serviceId).toBe('notification-api');
      expect(result.metadata?.version).toBe('2.1.0');
    });

    it('should validate tenant access (placeholder)', () => {
      const tenantContext = createTenantContext('valid-tenant');

      const result = tenantResolverService.validateTenantAccess(tenantContext);

      expect(result).toBe(true);
    });
  });

  describe('2.3 KEK Management Infrastructure', () => {
    beforeEach(() => {
      (dopplerClient.getSecret as jest.Mock).mockResolvedValue({
        value: Buffer.from('test-kek-32-bytes-long-for-aes25').toString(
          'base64',
        ), // Exactly 32 bytes
        version: '1',
        project: 'gs-notification',
        config: 'production',
      });
    });

    it('should setup KEK for new tenant', async () => {
      const tenantContext = createTenantContext('new-tenant');

      // Mock that KEK doesn't exist yet
      (dopplerClient.getSecret as jest.Mock).mockRejectedValueOnce(
        new Error('Not found'),
      );

      const result = await kekManagementService.setupTenantKek(tenantContext);

      expect(result).toBe('TENANT_KEK_NEW-TENANT_V1');
    });

    it('should retrieve existing KEK for tenant', async () => {
      const tenantContext = createTenantContext('existing-tenant');

      const result = await kekManagementService.getTenantKek(tenantContext);

      expect(result).toBeInstanceOf(Buffer);
      expect(result?.length).toBe(32); // 256 bits for AES-256
      expect(dopplerClient.getSecret).toHaveBeenCalledWith(
        'TENANT_KEK_EXISTING-TENANT_V1',
      );
    });

    it('should return null for missing KEK when throwOnMissing is false', async () => {
      const tenantContext = createTenantContext('missing-tenant');
      (dopplerClient.getSecret as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      const result = await kekManagementService.getTenantKek(
        tenantContext,
        false,
      );

      expect(result).toBeNull();
    });

    it('should throw error for missing KEK when throwOnMissing is true', async () => {
      const tenantContext = createTenantContext('missing-tenant');
      (dopplerClient.getSecret as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      await expect(
        kekManagementService.getTenantKek(tenantContext, true),
      ).rejects.toThrow('Failed to retrieve KEK for tenant missing-tenant');
    });

    it('should rotate KEK for tenant', async () => {
      const tenantContext = createTenantContext('rotation-tenant');

      const result = await kekManagementService.rotateTenantKek(
        tenantContext,
        'V2',
      );

      expect(result.oldKekId).toBe('TENANT_KEK_ROTATION-TENANT_V1');
      expect(result.newKekId).toBe('TENANT_KEK_ROTATION-TENANT_V2');
    });

    it('should generate proper KEK IDs', () => {
      const tenantContext = createTenantContext('test-client-123');

      const kekIdV1 = getTenantKekId(tenantContext, 'V1');
      const kekIdV2 = getTenantKekId(tenantContext, 'V2');

      expect(kekIdV1).toBe('TENANT_KEK_TEST-CLIENT-123_V1');
      expect(kekIdV2).toBe('TENANT_KEK_TEST-CLIENT-123_V2');
    });

    it('should list tenant KEKs', async () => {
      const tenantContext = createTenantContext('list-tenant');

      const result = await kekManagementService.listTenantKeks(tenantContext);

      expect(result).toContain('TENANT_KEK_LIST-TENANT_V1');
    });

    it('should handle KEK management errors gracefully', async () => {
      const tenantContext = createTenantContext('error-tenant');
      (dopplerClient.getSecret as jest.Mock).mockRejectedValue(
        new Error('Doppler error'),
      );

      // The service should still succeed by creating a new KEK even when Doppler has issues
      const result = await kekManagementService.setupTenantKek(tenantContext);
      expect(result).toBe('TENANT_KEK_ERROR-TENANT_V1');
    });
  });

  describe('2.4 Tenant Context Integration', () => {
    it('should create valid tenant context with all properties', () => {
      const tenantContext = createTenantContext('full-tenant', {
        tenantName: 'Full Test Tenant',
        organizationId: 'org-456',
        tenantTier: 'professional',
        region: 'us-east-1',
        metadata: {
          customField: 'customValue',
          features: ['feature1', 'feature2'],
        },
      });

      expect(tenantContext).toEqual({
        tenantId: 'full-tenant',
        tenantName: 'Full Test Tenant',
        organizationId: 'org-456',
        tenantTier: 'professional',
        region: 'us-east-1',
        metadata: {
          customField: 'customValue',
          features: ['feature1', 'feature2'],
        },
      });
    });

    it('should validate tenant context thoroughly', () => {
      // Valid tenant IDs
      expect(() => createTenantContext('valid-tenant-123')).not.toThrow();
      expect(() => createTenantContext('valid_tenant')).not.toThrow();
      expect(() => createTenantContext('VALID123')).not.toThrow();

      // Invalid tenant IDs
      expect(() => createTenantContext('')).toThrow();
      expect(() => createTenantContext('invalid.tenant')).toThrow();
      expect(() => createTenantContext('invalid tenant')).toThrow();
      expect(() => createTenantContext('invalid@tenant')).toThrow();
    });

    it('should handle tenant context in multi-tenant scenarios', () => {
      const tenants = ['core', 'acme', 'enterprise-123', 'dev_tenant'];

      tenants.forEach((tenantId) => {
        const context = createTenantContext(tenantId);
        const kekId = getTenantKekId(context);

        expect(context.tenantId).toBe(tenantId);
        expect(kekId).toBe(`TENANT_KEK_${tenantId.toUpperCase()}_V1`);
      });
    });
  });
});
