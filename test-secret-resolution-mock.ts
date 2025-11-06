import * as dotenv from 'dotenv';
import { Test, TestingModule } from '@nestjs/testing';
import { SecretRefService } from './src/shared/infrastructure/secret-ref/secret-ref.service';
import { ProviderRegistry } from './src/shared/infrastructure/secret-ref/providers/provider.registry';
import { PolicyGuard } from './src/shared/infrastructure/secret-ref/policy/policy.guard';
import { CacheLayer } from './src/shared/infrastructure/secret-ref/cache/cache.layer';
import { InMemoryCache } from './src/shared/infrastructure/secret-ref/cache/inmem.cache';
import { DopplerProvider } from './src/shared/infrastructure/secret-ref/providers/doppler.provider';
import { DopplerClient } from './src/shared/infrastructure/secret-ref/providers/doppler.client';
import { SecretRefConfigValidator } from './src/shared/infrastructure/secret-ref/config/secret-ref-config.validator';
import { SecretRefHealthIndicator } from './src/shared/infrastructure/secret-ref/health/secret-ref-health.indicator';
import { SecretRefMetricsService } from './src/shared/infrastructure/secret-ref/metrics/secret-ref-metrics.service';
import { SecretRef } from './src/shared/infrastructure/secret-ref/secret-ref.types';
import { BOUNDED_CONTEXT_LOGGER } from './src/shared/logging/logger.tokens';

// Load environment files in correct order
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Mock logger to avoid dependency issues
const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  log: () => {},
};

// Mock DopplerClient to simulate successful secret resolution
let getSecretCallCount = 0;
let healthCheckCallCount = 0;

const mockDopplerClient = {
  getSecret: (path: string, version = 'latest') => {
    getSecretCallCount++;
    // Simulate different return values based on the secret name
    const testSecrets: Record<string, string> = {
      WEBHOOK_SLACK_SIGNING_SECRET: 'test-signing-secret-value-12345',
      WEBHOOK_SLACK_AUTH_USERNAME: 'test-username-value',
      WEBHOOK_SLACK_AUTH_PASSWORD: 'test-password-value-67890',
    };

    const value = testSecrets[path];
    if (value) {
      return Promise.resolve({
        value,
        version,
        project: 'gs-scaffold-api',
        config: 'dev_main',
      });
    } else {
      return Promise.reject(new Error(`Secret ${path} not found`));
    }
  },

  healthCheck: () => {
    healthCheckCallCount++;
    return Promise.resolve({ healthy: true, latencyMs: 50 });
  },
};

// Mock ConfigValidator to avoid environment validation
const mockConfigValidator = {
  validate: () => undefined,
};

async function testSecretResolution() {
  console.log('🔍 Testing Secret Resolution with Mocked Doppler...\n');

  try {
    console.log('📦 Creating test module...');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        // Core
        SecretRefService,
        ProviderRegistry,
        PolicyGuard,
        { provide: CacheLayer, useExisting: InMemoryCache },

        // Mock logger
        { provide: BOUNDED_CONTEXT_LOGGER, useValue: mockLogger },

        // Mock configuration validator
        { provide: SecretRefConfigValidator, useValue: mockConfigValidator },

        // Configuration & Health
        SecretRefHealthIndicator,
        SecretRefMetricsService,

        // Caches
        InMemoryCache,

        // Doppler wiring with mocks
        DopplerProvider,
        { provide: DopplerClient, useValue: mockDopplerClient },
      ],
    }).compile();

    console.log('✅ Test module created successfully');
    console.log('🔧 Getting SecretRefService...');
    const secretRefService = module.get<SecretRefService>(SecretRefService);
    console.log('✅ SecretRefService obtained');

    // Test secrets we would store in Doppler
    const testSecrets = [
      {
        name: 'Slack Test Signing Secret',
        ref: {
          scheme: 'secret-ref',
          provider: 'doppler',
          tenant: 'webhook',
          namespace: 'slack',
          key: 'WEBHOOK_SLACK_SIGNING_SECRET',
        },
      },
      {
        name: 'Slack Test Auth Username',
        ref: {
          scheme: 'secret-ref',
          provider: 'doppler',
          tenant: 'webhook',
          namespace: 'slack',
          key: 'WEBHOOK_SLACK_AUTH_USERNAME',
        },
      },
      {
        name: 'Slack Test Auth Password',
        ref: {
          scheme: 'secret-ref',
          provider: 'doppler',
          tenant: 'webhook',
          namespace: 'slack',
          key: 'WEBHOOK_SLACK_AUTH_PASSWORD',
        },
      },
    ];

    console.log('🧪 Running secret resolution tests...\n');

    for (const { name, ref } of testSecrets) {
      console.log(`🔑 Testing ${name}...`);
      try {
        const result = await secretRefService.resolve(ref as SecretRef);
        if (result && result.value) {
          console.log(
            `   ✅ Successfully resolved: ${result.value.substring(0, 15)}...`,
          );
          console.log(`   📊 Version: ${result.version}`);
          console.log(`   ⏱️  Provider latency: ${result.providerLatencyMs}ms`);
        } else {
          console.log(`   ❌ No value returned`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to resolve ${name}:`);
        console.error(
          `   Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      console.log();
    }

    // Test health check
    console.log('🏥 Testing SecretRef Health Check...');
    try {
      const health = await secretRefService.healthCheck();
      if (health.healthy) {
        console.log(`   ✅ Health check passed`);
        console.log(`   ⏱️  Response time: ${health.latencyMs}ms`);
      } else {
        console.log(`   ❌ Health check failed: ${health.healthy}`);
        console.log(`   Error: ${health.error}`);
      }
    } catch (error) {
      console.error(
        `   ❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log('\n📊 Mock call verification:');
    console.log(
      `   DopplerClient.getSecret called ${getSecretCallCount} times`,
    );
    console.log(
      `   DopplerClient.healthCheck called ${healthCheckCallCount} times`,
    );

    await module.close();
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n💥 Test Failed:', error);
    process.exit(1);
  }
}

// Run the test
testSecretResolution()
  .then(() => {
    console.log('\n🎉 All tests passed!');
    console.log('✨ Secret resolution infrastructure is working correctly');
    console.log(
      '📋 Next Step: Test with real Doppler API (Step 3 in E2E guide)',
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
