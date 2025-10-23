import { Test, TestingModule } from '@nestjs/testing';
import {
  PIIClassificationService,
  PIICategory,
} from './pii-classification.service';
import {
  DefaultPIIPolicyProvider,
  registerDomainPolicy,
} from './policy.provider';
import { PII_POLICY_PROVIDER } from './pii-policy';
import { PRODUCT_CONFIG_POLICY } from '../../../contexts/bank/product-config/policies/pii/product-config-policy';

describe('PIIClassificationService', () => {
  let service: PIIClassificationService;
  let policyProvider: DefaultPIIPolicyProvider;

  beforeEach(async () => {
    // Register the product-config policy for testing
    registerDomainPolicy(PRODUCT_CONFIG_POLICY);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PII_POLICY_PROVIDER,
          useClass: DefaultPIIPolicyProvider,
        },
        PIIClassificationService,
      ],
    }).compile();

    service = module.get<PIIClassificationService>(PIIClassificationService);
    policyProvider = module.get<DefaultPIIPolicyProvider>(PII_POLICY_PROVIDER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(policyProvider).toBeDefined();
  });

  describe('dependency injection', () => {
    it('should properly inject PIIPolicyProvider', () => {
      expect(service).toBeInstanceOf(PIIClassificationService);
      expect(policyProvider).toBeInstanceOf(DefaultPIIPolicyProvider);
    });
  });

  describe('path-aware PII classification', () => {
    it('should classify data with domain context', () => {
      const testData = {
        customerName: 'John Doe',
        railName: 'ACH_STANDARD',
        amount: 100.5,
      };

      const result = service.classifyData(testData, {
        domain: 'product-config',
      });

      expect(result).toBeDefined();
      expect(result.containsPII).toBe(true);
      expect(result.sensitiveFields).toContain('customerName');
      expect(result.matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'customerName',
            categories: expect.arrayContaining([
              PIICategory.PERSONAL_IDENTIFIER,
            ]),
          }),
        ]),
      );
    });

    it('should handle nested path classification', () => {
      const testData = {
        customer: {
          name: 'Jane Smith',
          age: 30,
        },
        rail: {
          name: 'ACH_STANDARD',
          code: 'ACH',
        },
      };

      const result = service.classifyData(testData, {
        domain: 'product-config',
      });

      expect(result).toBeDefined();
      expect(result.containsPII).toBe(true);
      // Should detect customer.name as PII (fieldName is 'name', but path is 'customer.name')
      expect(result.sensitiveFields).toContain('name');
      expect(result.matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'customer.name',
            fieldName: 'name',
            detector: 'path_rule',
            confidence: 1,
          }),
        ]),
      );
    });

    it('should apply precedence rules correctly', () => {
      const testData = {
        email: 'user@example.com',
        userEmail: 'admin@company.com',
      };

      const result = service.classifyData(testData, {
        domain: 'product-config',
      });

      expect(result).toBeDefined();
      expect(result.containsPII).toBe(true);
      // Both should be classified as PII due to pattern matching
      expect(result.sensitiveFields).toContain('email');
      expect(result.sensitiveFields).toContain('userEmail');
    });
  });

  describe('policy provider integration', () => {
    it('should retrieve policies for different domains', () => {
      const productConfigPolicy = policyProvider.getPolicy({
        domain: 'product-config',
      });
      const defaultPolicy = policyProvider.getPolicy({
        domain: 'unknown-domain',
      });

      expect(productConfigPolicy).toBeDefined();
      expect(productConfigPolicy.domain).toBe('product-config');

      expect(defaultPolicy).toBeDefined();
      expect(defaultPolicy.domain).toBe('unknown-domain');
    });
  });
});
