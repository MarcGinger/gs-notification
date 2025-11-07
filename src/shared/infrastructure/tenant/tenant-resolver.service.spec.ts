import { Test, TestingModule } from '@nestjs/testing';
import { TenantResolverService } from '../../../shared/infrastructure/tenant/tenant-resolver.service';
import { TenantContext } from '../../../shared/domain/tenant';
import { Request } from 'express';

describe('TenantResolverService', () => {
  let service: TenantResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantResolverService],
    }).compile();

    service = module.get<TenantResolverService>(TenantResolverService);
  });

  describe('resolveTenantFromRequest', () => {
    it('should resolve tenant from X-Tenant-ID header', () => {
      const mockRequest = {
        headers: {
          'x-tenant-id': 'acme-corp',
          'x-organization-id': 'org-123',
          'x-tenant-tier': 'enterprise',
          'x-region': 'us-west-2',
          'user-agent': 'test-agent/1.0',
          'x-request-id': 'req-456',
        },
        ip: '192.168.1.100',
      } as unknown as Request;

      const result = service.resolveTenantFromRequest(mockRequest);

      expect(result).toEqual({
        tenantId: 'acme-corp',
        organizationId: 'org-123',
        tenantTier: 'enterprise',
        region: 'us-west-2',
        metadata: {
          userAgent: 'test-agent/1.0',
          ip: '192.168.1.100',
          requestId: 'req-456',
        },
      });
    });

    it('should resolve tenant from subdomain', () => {
      const mockRequest = {
        headers: {
          host: 'acme.gs.com',
        },
      } as unknown as Request;

      const result = service.resolveTenantFromRequest(mockRequest);

      expect(result).toEqual({
        tenantId: 'acme',
        metadata: {
          resolveStrategy: 'subdomain',
          originalHost: 'acme.gs.com',
        },
      });
    });

    it('should ignore www and api subdomains', () => {
      const mockRequestWww = {
        headers: {
          host: 'www.gs.com',
        },
      } as unknown as Request;

      const mockRequestApi = {
        headers: {
          host: 'api.gs.com',
        },
      } as unknown as Request;

      const resultWww = service.resolveTenantFromRequest(mockRequestWww);
      const resultApi = service.resolveTenantFromRequest(mockRequestApi);

      // Should fall back to default tenant
      expect(resultWww.tenantId).toBe('core');
      expect(resultApi.tenantId).toBe('core');
    });

    it('should fallback to default tenant when no context found', () => {
      const mockRequest = {
        headers: {},
      } as unknown as Request;

      const result = service.resolveTenantFromRequest(mockRequest);

      expect(result).toEqual({
        tenantId: 'core',
        tenantName: 'Core System',
        tenantTier: 'enterprise',
        metadata: {
          isDefault: true,
          resolveStrategy: 'fallback',
        },
      });
    });

    it('should handle localhost subdomains', () => {
      const mockRequest = {
        headers: {
          host: 'tenant-dev.localhost',
        },
      } as unknown as Request;

      const result = service.resolveTenantFromRequest(mockRequest);

      expect(result).toEqual({
        tenantId: 'tenant-dev',
        metadata: {
          resolveStrategy: 'subdomain',
          originalHost: 'tenant-dev.localhost',
        },
      });
    });
  });

  describe('resolveTenantFromServiceContext', () => {
    it('should create tenant context from service call', () => {
      const result = service.resolveTenantFromServiceContext('service-tenant', {
        serviceId: 'notification-service',
        version: '1.0.0',
      });

      expect(result).toEqual({
        tenantId: 'service-tenant',
        metadata: {
          serviceId: 'notification-service',
          version: '1.0.0',
        },
      });
    });

    it('should fallback to default when no tenant ID provided', () => {
      const result = service.resolveTenantFromServiceContext();

      expect(result.tenantId).toBe('core');
      expect(result.metadata?.isDefault).toBe(true);
    });
  });

  describe('validateTenantAccess', () => {
    it('should allow access for all tenants (placeholder)', () => {
      const tenantContext: TenantContext = {
        tenantId: 'test-tenant',
      };

      const result = service.validateTenantAccess(tenantContext);

      expect(result).toBe(true);
    });
  });
});
