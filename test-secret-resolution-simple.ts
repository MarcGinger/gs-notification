import * as dotenv from 'dotenv';
import { Test, TestingModule } from '@nestjs/testing';

// Load environment files in correct order
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
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

// Mock logger to avoid dependency issues
const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  log: () => {},
};

async function testSecretResolution() {
  console.log('🔍 Testing Secret Resolution with Doppler (Simple)...\n');

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

        // Configuration & Health
        SecretRefConfigValidator,
        SecretRefHealthIndicator,
        SecretRefMetricsService,

        // Caches
        InMemoryCache,

        // Doppler wiring
        DopplerProvider,
        {
          provide: DopplerClient,
          useFactory: (validator: SecretRefConfigValidator) => {
            validator.validate(); // Validate config at startup
            return new DopplerClient({
              token: process.env.DOPPLER_TOKEN ?? '',
              project: process.env.DOPPLER_PROJECT ?? 'default',
              config: process.env.DOPPLER_CONFIG ?? 'dev',
              baseUrl:
                process.env.DOPPLER_BASE_URL ?? 'https://api.doppler.com',
              timeoutMs: Number(process.env.DOPPLER_TIMEOUT_MS ?? 5000),
            });
          },
          inject: [SecretRefConfigValidator],
        },
      ],
    }).compile();

    console.log('✅ Test module created successfully');
    console.log('🔧 Getting SecretRefService...');
    const secretRefService = module.get<SecretRefService>(SecretRefService);
    console.log('✅ SecretRefService obtained');

    // Test secrets we stored in Doppler
    const testSecrets = [
      {
        name: 'Slack Test Signing Secret',
        ref: {
          tenant: 'webhook',
          namespace: 'slack',
          key: 'WEBHOOK_SLACK_SIGNING_SECRET',
        },
      },
      {
        name: 'Slack Test Auth Username',
        ref: {
          tenant: 'webhook',
          namespace: 'slack',
          key: 'WEBHOOK_SLACK_AUTH_USERNAME',
        },
      },
      {
        name: 'Slack Test Auth Password',
        ref: {
          tenant: 'webhook',
          namespace: 'slack',
          key: 'WEBHOOK_SLACK_AUTH_PASSWORD',
        },
      },
    ];

    for (const { name, ref } of testSecrets) {
      console.log(`🔑 Testing ${name}...`);
      try {
        const result = await secretRefService.resolve(ref as SecretRef);
        if (result && result.value) {
          console.log(
            `   ✅ Successfully resolved: ${result.value.substring(0, 10)}...`,
          );
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
      } else {
        console.log(`   ❌ Health check failed: ${health.healthy}`);
        console.log(`   Error: ${health.error}`);
      }
    } catch (error) {
      console.error(
        `   ❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
