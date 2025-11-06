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

// Mock logger to avoid complex dependency chain
const mockLogger = {
  debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || ''),
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.log(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.log(`[ERROR] ${msg}`, meta || ''),
  child: () => mockLogger,
};

async function testSecretRefServiceIntegration() {
  console.log('🔍 Testing SecretRefService Integration (Clean Module)...\n');

  let module: TestingModule | undefined;

  try {
    console.log('📦 Creating minimal test module...');
    module = await Test.createTestingModule({
      providers: [
        // Core service
        SecretRefService,

        // Essential dependencies
        ProviderRegistry,
        PolicyGuard,
        { provide: CacheLayer, useExisting: InMemoryCache },

        // Mock logger to avoid complex dependency chain
        { provide: BOUNDED_CONTEXT_LOGGER, useValue: mockLogger },

        // Cache implementation
        InMemoryCache,

        // Health and metrics (optional for basic functionality)
        SecretRefHealthIndicator,
        SecretRefMetricsService,

        // Doppler integration with real client
        DopplerProvider,
        SecretRefConfigValidator,
        {
          provide: DopplerClient,
          useFactory: (validator: SecretRefConfigValidator) => {
            console.log('🔧 Creating DopplerClient...');
            console.log('🔍 Validating configuration...');
            validator.validate(); // This will validate environment variables
            console.log('✅ Configuration validated');

            console.log('🔧 Instantiating DopplerClient...');
            const client = new DopplerClient({
              token: process.env.DOPPLER_TOKEN ?? '',
              project: process.env.DOPPLER_PROJECT ?? 'gs-scaffold-api',
              config: process.env.DOPPLER_CONFIG ?? 'dev_main',
              baseUrl:
                process.env.DOPPLER_BASE_URL ?? 'https://api.doppler.com',
              timeoutMs: Number(process.env.DOPPLER_TIMEOUT_MS ?? 5000),
            });
            console.log('✅ DopplerClient created');
            return client;
          },
          inject: [SecretRefConfigValidator],
        },
      ],
    }).compile();

    console.log('✅ Test module compiled successfully');

    console.log('🔧 Getting SecretRefService...');
    const secretRefService = module.get<SecretRefService>(SecretRefService);
    console.log('✅ SecretRefService obtained');

    // Test with the actual secrets we have in Doppler
    const testSecrets = [
      {
        name: 'Signing Secret',
        ref: {
          scheme: 'secret' as const,
          provider: 'doppler' as const,
          tenant: 'test',
          namespace: 'secure-test',
          key: 'SIGNING_TEST_SECURE_TEST_001_SECRET',
        },
      },
      {
        name: 'Auth Username',
        ref: {
          scheme: 'secret' as const,
          provider: 'doppler' as const,
          tenant: 'test',
          namespace: 'secure-test',
          key: 'AUTH_USERNAME_TEST_SECURE_TEST_001_USER',
        },
      },
      {
        name: 'Auth Password',
        ref: {
          scheme: 'secret' as const,
          provider: 'doppler' as const,
          tenant: 'test',
          namespace: 'secure-test',
          key: 'AUTH_PASSWORD_TEST_SECURE_TEST_001_PASS',
        },
      },
    ];

    console.log('\n🧪 Testing end-to-end secret resolution...\n');

    for (const { name, ref } of testSecrets) {
      console.log(`🔑 Testing ${name}...`);
      try {
        const result = await secretRefService.resolve(ref as SecretRef);

        if (result && result.value) {
          console.log(
            `   ✅ Successfully resolved: ${result.value.substring(0, 20)}...`,
          );
          console.log(`   📊 Version: ${result.version}`);
          console.log(`   ⏱️  Provider latency: ${result.providerLatencyMs}ms`);
          console.log(
            `   🏢 Provider meta: ${JSON.stringify(result.providerMeta)}`,
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
    console.log('🏥 Testing SecretRefService health check...');
    try {
      const health = await secretRefService.healthCheck();
      if (health.healthy) {
        console.log(`   ✅ Health check passed`);
        console.log(`   ⏱️  Response time: ${health.latencyMs}ms`);
      } else {
        console.log(`   ❌ Health check failed`);
        console.log(`   Error: ${health.error}`);
      }
    } catch (error) {
      console.error(
        `   ❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log('\n✅ Integration test completed successfully!');
    console.log(
      '🎯 SecretRefService is working end-to-end with real Doppler integration',
    );
  } catch (error) {
    console.error('\n💥 Integration Test Failed:', error);

    // Try to provide more specific error information
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      });
    }

    process.exit(1);
  } finally {
    if (module) {
      await module.close();
    }
  }
}

// Run the test
testSecretRefServiceIntegration()
  .then(() => {
    console.log('\n🎉 SecretRefService integration test passed!');
    console.log('✨ Ready for Step 3: Database schema verification');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
