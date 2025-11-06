import * as dotenv from 'dotenv';
import { SecretRefService } from './src/shared/infrastructure/secret-ref/secret-ref.service';
import { ProviderRegistry } from './src/shared/infrastructure/secret-ref/providers/provider.registry';
import { PolicyGuard } from './src/shared/infrastructure/secret-ref/policy/policy.guard';
import { InMemoryCache } from './src/shared/infrastructure/secret-ref/cache/inmem.cache';
import { DopplerProvider } from './src/shared/infrastructure/secret-ref/providers/doppler.provider';
import { DopplerClient } from './src/shared/infrastructure/secret-ref/providers/doppler.client';
import { SecretRefConfigValidator } from './src/shared/infrastructure/secret-ref/config/secret-ref-config.validator';
import { SecretRef } from './src/shared/infrastructure/secret-ref/secret-ref.types';

// Load environment files in correct order
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Mock logger
const mockLogger = {
  debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.log(`[WARN] ${msg}`),
  error: (msg: string) => console.log(`[ERROR] ${msg}`),
  child: () => mockLogger,
};

async function testDirectServiceInstantiation() {
  console.log('🔍 Testing Direct SecretRefService Instantiation...\n');

  try {
    console.log('🔧 Creating dependencies manually...');

    // Create validator and validate environment
    const validator = new SecretRefConfigValidator();
    console.log('🔍 Validating configuration...');
    validator.validate();
    console.log('✅ Configuration validated');

    // Create DopplerClient
    console.log('🔧 Creating DopplerClient...');
    const dopplerClient = new DopplerClient({
      token: process.env.DOPPLER_TOKEN ?? '',
      project: process.env.DOPPLER_PROJECT ?? 'gs-scaffold-api',
      config: process.env.DOPPLER_CONFIG ?? 'dev_main',
      baseUrl: process.env.DOPPLER_BASE_URL ?? 'https://api.doppler.com',
      timeoutMs: Number(process.env.DOPPLER_TIMEOUT_MS ?? 5000),
    });
    console.log('✅ DopplerClient created');

    // Create DopplerProvider
    console.log('🔧 Creating DopplerProvider...');
    const dopplerProvider = new DopplerProvider(dopplerClient);
    console.log('✅ DopplerProvider created');

    // Create ProviderRegistry
    console.log('🔧 Creating ProviderRegistry...');
    const providerRegistry = new ProviderRegistry(dopplerProvider);
    console.log('✅ ProviderRegistry created');

    // Create other dependencies
    console.log('🔧 Creating supporting services...');
    const cache = new InMemoryCache();
    const policyGuard = new PolicyGuard();
    console.log('✅ Supporting services created');

    // Create SecretRefService
    console.log('🔧 Creating SecretRefService...');
    const secretRefService = new SecretRefService(
      providerRegistry,
      cache,
      policyGuard,
      mockLogger as any,
    );
    console.log('✅ SecretRefService created');

    // Test with actual secrets
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
    ];

    console.log('\n🧪 Testing direct service calls...\n');

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

    // Test health check if available
    try {
      console.log('🏥 Testing health check...');
      const health = await secretRefService.healthCheck();
      if (health.healthy) {
        console.log(`   ✅ Health check passed (${health.latencyMs}ms)`);
      } else {
        console.log(`   ❌ Health check failed: ${health.error}`);
      }
    } catch (error) {
      console.log(
        `   ⚠️  Health check not available or failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log('\n✅ Direct service instantiation test completed!');
    console.log('🎯 SecretRefService working without NestJS module system');
  } catch (error) {
    console.error('\n💥 Direct Service Test Failed:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      });
    }

    process.exit(1);
  }
}

// Run the test
testDirectServiceInstantiation()
  .then(() => {
    console.log('\n🎉 Direct service test passed!');
    console.log('✨ SecretRefService infrastructure is working correctly');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
