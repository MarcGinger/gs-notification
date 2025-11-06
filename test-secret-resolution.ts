/**
 * Test Secret Resolution with Doppler
 *
 * This script tests the complete secret resolution flow:
 * 1. SecretRef Service → Doppler Provider → Doppler API
 * 2. Verify we can resolve actual secret values
 * 3. Test caching and error handling
 */

import * as dotenv from 'dotenv';
import { Test, TestingModule } from '@nestjs/testing';
import { SecretRefService } from './src/shared/infrastructure/secret-ref/secret-ref.service';
import { SecretRefModule } from './src/shared/infrastructure/secret-ref/secret-ref.module';
import { SecretRef } from './src/shared/infrastructure/secret-ref/secret-ref.types';
import { LoggingModule } from './src/shared/logging/logging.module';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testSecretResolution() {
  console.log('🔍 Testing Secret Resolution with Doppler...\n');

  // Create testing module with SecretRef infrastructure
  const module: TestingModule = await Test.createTestingModule({
    imports: [LoggingModule, SecretRefModule],
  }).compile();

  const secretRefService = module.get<SecretRefService>(SecretRefService);

  // Test SecretRef objects that our system generates
  const testSecrets: { name: string; secretRef: SecretRef }[] = [
    {
      name: 'Signing Secret',
      secretRef: {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test-tenant',
        namespace: 'notification.webhook-config.secure-test',
        key: 'SIGNING_TEST_SECURE_TEST_001_SECRET',
      },
    },
    {
      name: 'Username',
      secretRef: {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test-tenant',
        namespace: 'notification.webhook-config.secure-test',
        key: 'AUTH_USERNAME_TEST_SECURE_TEST_001_USER',
      },
    },
    {
      name: 'Password',
      secretRef: {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test-tenant',
        namespace: 'notification.webhook-config.secure-test',
        key: 'AUTH_PASSWORD_TEST_SECURE_TEST_001_PASS',
      },
    },
  ];

  console.log('📝 Testing Secret Resolution...\n');

  for (const { name, secretRef } of testSecrets) {
    try {
      console.log(`🔐 Resolving ${name}:`);
      console.log(`   Key: ${secretRef.key}`);

      const resolved = await secretRefService.resolve(secretRef);

      console.log(`   ✅ Resolved successfully!`);
      console.log(`   Value: ${resolved.value.substring(0, 10)}...`);
      console.log(`   Version: ${resolved.version}`);
      console.log(`   Provider Latency: ${resolved.providerLatencyMs}ms`);
      console.log(
        `   Cache TTL: ${resolved.expiresAt ? new Date(resolved.expiresAt) : 'N/A'}`,
      );
      console.log();
    } catch (error) {
      console.error(`   ❌ Failed to resolve ${name}:`);
      console.error(
        `   Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.log();
    }
  }

  // Test health check
  console.log('🏥 Testing SecretRef Health Check...');
  try {
    const health = await secretRefService.healthCheck();
    console.log(`   Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   Latency: ${health.latencyMs || 'N/A'}ms`);
    if (health.error) {
      console.log(`   Error: ${health.error}`);
    }
  } catch (error) {
    console.error(
      `   ❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  await module.close();
}

// Run the test
testSecretResolution()
  .then(() => {
    console.log('\n🏁 Secret Resolution Test Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test Failed:', error);
    process.exit(1);
  });
