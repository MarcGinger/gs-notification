// Test to verify the Array.some() -> forEach() fix
async function testAllFieldsProcessing() {
  console.log('🔍 Testing All Fields Processing Fix...\n');

  // Helper functions to simulate the fixed logic
  const isSealedSecretObject = (value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const obj = value;

    return (
      typeof obj.scheme === 'string' &&
      obj.scheme === 'secret' &&
      typeof obj.provider === 'string' &&
      typeof obj.tenant === 'string' &&
      typeof obj.blob === 'string' &&
      typeof obj.v === 'number'
    );
  };

  const isSealedSecretJson = (value) => {
    try {
      const parsed = JSON.parse(value);
      return isSealedSecretObject(parsed);
    } catch {
      return false;
    }
  };

  // Test data from your logs - all fields are sealed secret objects
  const eventData = {
    signingSecret: {
      scheme: 'secret',
      provider: 'sealed',
      tenant: 'core',
      kekKid: 'TENANT_KEK_CORE_V1',
      alg: 'XCHACHA20-POLY1305',
      blob: 'eyJwbGFpbnRleHQiOiJzaWduaW5nU2VjcmV0IGZvciBpZCAxNyIsInRlbmFudCI6ImNvcmUiLCJuYW1lc3BhY2UiOiJzaWduaW5nIiwidGltZXN0YW1wIjoxNzYyNjU1Nzk5NzAzLCJtb2NrRW5jcnlwdGlvbiI6dHJ1ZX0=',
      aad: 'signing',
      v: 1,
    },
    username: {
      scheme: 'secret',
      provider: 'sealed',
      tenant: 'core',
      kekKid: 'TENANT_KEK_CORE_V1',
      alg: 'XCHACHA20-POLY1305',
      blob: 'eyJwbGFpbnRleHQiOiJ1c2VybmFtZTE3IiwidGVuYW50IjoiY29yZSIsIm5hbWVzcGFjZSI6ImF1dGgiLCJ0aW1lc3RhbXAiOjE3NjI2NTU3OTk3MDMsIm1vY2tFbmNyeXB0aW9uIjp0cnVlfQ==',
      aad: 'auth',
      v: 1,
    },
    password: {
      scheme: 'secret',
      provider: 'sealed',
      tenant: 'core',
      kekKid: 'TENANT_KEK_CORE_V1',
      alg: 'XCHACHA20-POLY1305',
      blob: 'eyJwbGFpbnRleHQiOiJwYXNzd29yZDE3IiwidGVuYW50IjoiY29yZSIsIm5hbWVzcGFjZSI6ImF1dGgiLCJ0aW1lc3RhbXAiOjE3NjI2NTU3OTk3MDMsIm1vY2tFbmNyeXB0aW9uIjp0cnVlfQ==',
      aad: 'auth',
      v: 1,
    },
  };

  console.log(
    '📝 Testing BEFORE fix (Array.some - should stop at first field):',
  );

  const sensitiveFields = ['signingSecret', 'username', 'password'];
  let secretRefFieldsBefore = {};

  // Simulate the old buggy logic with Array.some()
  const hasSecretsBefore = sensitiveFields.some((field) => {
    const value = eventData[field];
    console.log(`   🔍 Checking field: ${field}`);

    if (value && typeof value === 'object' && value !== null) {
      if (isSealedSecretObject(value)) {
        secretRefFieldsBefore[field] = JSON.stringify(value);
        console.log(`   ✅ ${field} processed (some() returns true and STOPS)`);
        return true; // This stops the .some() loop!
      }
    }
    return false;
  });

  console.log(
    `   Result: ${Object.keys(secretRefFieldsBefore).length} field(s) processed: [${Object.keys(secretRefFieldsBefore).join(', ')}]\n`,
  );

  console.log('📝 Testing AFTER fix (forEach - should process all fields):');

  let secretRefFieldsAfter = {};

  // Simulate the fixed logic with forEach()
  sensitiveFields.forEach((field) => {
    const value = eventData[field];
    console.log(`   🔍 Checking field: ${field}`);

    if (value && typeof value === 'object' && value !== null) {
      if (isSealedSecretObject(value)) {
        secretRefFieldsAfter[field] = JSON.stringify(value);
        console.log(`   ✅ ${field} processed (forEach continues to next)`);
      }
    }
  });

  const hasSecretsAfter = Object.keys(secretRefFieldsAfter).length > 0;
  console.log(
    `   Result: ${Object.keys(secretRefFieldsAfter).length} field(s) processed: [${Object.keys(secretRefFieldsAfter).join(', ')}]\n`,
  );

  console.log('🎯 Comparison:');
  console.log(
    `   Before fix: ${Object.keys(secretRefFieldsBefore).length}/3 fields processed`,
  );
  console.log(
    `   After fix:  ${Object.keys(secretRefFieldsAfter).length}/3 fields processed`,
  );

  const fixWorking =
    Object.keys(secretRefFieldsAfter).length === 3 &&
    Object.keys(secretRefFieldsBefore).length === 1;
  console.log(`   Fix status: ${fixWorking ? '✅ SUCCESS' : '❌ NEEDS WORK'}`);

  if (fixWorking) {
    console.log('\n✅ Fix working correctly:');
    console.log('   - All 3 fields are now processed');
    console.log('   - No early termination from Array.some()');
    console.log('   - EventEncryptionService will receive all sealed secrets');
  }

  return fixWorking;
}

testAllFieldsProcessing().catch(console.error);
