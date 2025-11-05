import { Test } from '@nestjs/testing';
import { SecretRefService } from '../secret-ref.service';
import { DopplerClient } from '../providers/doppler.client';
import { CacheLayer } from '../cache/cache.layer';
import { PolicyGuard } from '../policy/policy.guard';
import { ProviderRegistry } from '../providers/provider.registry';
import { DopplerProvider } from '../providers/doppler.provider';
import { SecretRef, SecretRefError } from '../secret-ref.types';
import { BOUNDED_CONTEXT_LOGGER, Logger } from '../../../logging';

describe('SecretRefService', () => {
  let service: SecretRefService;
  let mockDopplerClient: jest.Mocked<DopplerClient>;
  let mockCache: jest.Mocked<CacheLayer>;
  let mockPolicy: jest.Mocked<PolicyGuard>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SecretRefService,
        {
          provide: DopplerClient,
          useValue: createMockDopplerClient(),
        },
        {
          provide: CacheLayer,
          useValue: createMockCache(),
        },
        {
          provide: PolicyGuard,
          useValue: createMockPolicy(),
        },
        {
          provide: BOUNDED_CONTEXT_LOGGER,
          useValue: createMockLogger(),
        },
        ProviderRegistry,
        DopplerProvider,
      ],
    }).compile();

    service = module.get<SecretRefService>(SecretRefService);
    mockDopplerClient = module.get(DopplerClient);
    mockCache = module.get(CacheLayer);
    mockPolicy = module.get(PolicyGuard);
    mockLogger = module.get(BOUNDED_CONTEXT_LOGGER);
  });

  describe('resolve', () => {
    it('should return cached value if available', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };
      const cached = {
        value: 'cached-secret',
        version: '1',
        providerLatencyMs: 100,
      };

      mockCache.get.mockResolvedValue(cached);

      const result = await service.resolve(ref);

      expect(result).toBe(cached);
      expect(mockDopplerClient.getSecret).not.toHaveBeenCalled();
    });

    it('should deduplicate concurrent requests for same secret', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };

      mockCache.get.mockResolvedValue(null);
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'secret-value',
        version: '1',
        project: 'test-project',
        config: 'dev',
      });

      // Fire multiple concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => service.resolve(ref));
      await Promise.all(promises);

      // Should only call provider once due to deduplication
      expect(mockDopplerClient.getSecret).toHaveBeenCalledTimes(1);
    });

    it('should enforce policy rules', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };

      mockPolicy.ensureAllowed.mockImplementation(() => {
        throw new SecretRefError('Policy denied', 'POLICY_DENIED', ref);
      });

      await expect(service.resolve(ref)).rejects.toThrow('Policy denied');
    });

    it('should not log secret values', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };

      mockCache.get.mockResolvedValue(null);
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'super-secret-value',
        version: '1',
        project: 'test-project',
        config: 'dev',
      });

      await service.resolve(ref);

      // Assert that no log contains the secret value
      const allLogCalls = mockLogger.info.mock.calls
        .concat(mockLogger.error.mock.calls)
        .flat();
      const allLogs = JSON.stringify(allLogCalls);
      expect(allLogs).not.toContain('super-secret-value');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when canary check passes', async () => {
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'canary-value',
        version: '1',
        project: 'test-project',
        config: 'dev',
      });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should return unhealthy status when canary check fails', async () => {
      mockDopplerClient.getSecret.mockRejectedValue(new Error('Provider down'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Provider down');
    });
  });
});

function createMockDopplerClient(): jest.Mocked<DopplerClient> {
  return {
    getSecret: jest.fn(),
  } as any;
}

function createMockCache(): jest.Mocked<CacheLayer> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    buildKey: jest.fn((ref) => `test-key-${ref.key}`),
    computeTtl: jest.fn(() => 300000),
  };
}

function createMockPolicy(): jest.Mocked<PolicyGuard> {
  return {
    ensureAllowed: jest.fn(),
  } as any;
}

function createMockLogger(): jest.Mocked<Logger> {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as any;
}
