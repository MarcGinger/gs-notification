import * as dotenv from 'dotenv';

// Load environment files in correct order
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { DopplerClient } from './src/shared/infrastructure/secret-ref/providers/doppler.client';

async function testDopplerDirectly() {
  console.log('🔍 Testing Direct Doppler Client Integration...\n');

  try {
    // Create DopplerClient with environment config
    const client = new DopplerClient({
      token: process.env.DOPPLER_TOKEN ?? '',
      project: process.env.DOPPLER_PROJECT ?? 'gs-scaffold-api',
      config: process.env.DOPPLER_CONFIG ?? 'dev_main',
      baseUrl: process.env.DOPPLER_BASE_URL ?? 'https://api.doppler.com',
      timeoutMs: Number(process.env.DOPPLER_TIMEOUT_MS ?? 5000),
    });

    console.log('✅ DopplerClient created successfully');
    console.log(
      `📡 Connecting to: ${process.env.DOPPLER_PROJECT}/${process.env.DOPPLER_CONFIG}`,
    );

    // Test secrets we stored in Doppler (using actual names from `doppler secrets`)
    const testSecrets = [
      'SIGNING_TEST_SECURE_TEST_001_SECRET',
      'AUTH_USERNAME_TEST_SECURE_TEST_001_USER',
      'AUTH_PASSWORD_TEST_SECURE_TEST_001_PASS',
    ];

    console.log('\n🧪 Testing direct secret retrieval...\n');

    for (const secretName of testSecrets) {
      console.log(`🔑 Testing ${secretName}...`);
      try {
        const result = await client.getSecret(secretName);
        console.log(`   ✅ Successfully retrieved!`);
        console.log(`   🔍 Value type: ${typeof result.value}`);
        console.log(`   ✅ Secret value: ${result.value.substring(0, 20)}...`);
        console.log(`   📊 Version: ${result.version}`);
        console.log(`   🏢 Project: ${result.project}`);
        console.log(`   ⚙️  Config: ${result.config}`);
      } catch (error) {
        console.error(`   ❌ Failed to retrieve ${secretName}:`);
        console.error(
          `   Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      console.log();
    }

    // Test a basic connectivity check by trying to get a non-existent secret
    console.log('🏥 Testing client connectivity...');
    try {
      await client.getSecret('NON_EXISTENT_SECRET_TEST_12345');
      console.log(`   ❓ Unexpected success for non-existent secret`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        console.log(
          `   ✅ Connectivity confirmed (expected 'not found' error)`,
        );
      } else {
        console.log(
          `   ❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    console.log('\n✅ Direct Doppler integration test completed!');
    console.log(
      '🎯 Next: Test via SecretRefService (when NestJS module issues are resolved)',
    );
  } catch (error) {
    console.error('\n💥 Test Failed:', error);
    process.exit(1);
  }
}

// Run the test
testDopplerDirectly()
  .then(() => {
    console.log('\n🎉 Direct Doppler integration working!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
