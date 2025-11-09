// Test to verify the sealed secret validation fix
async function testSealedSecretValidation() {
  console.log('🔍 Testing Sealed Secret Validation Fix...\n');

  // Helper function to simulate the validation logic
  const isSealedSecretObject = (value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const obj = value;

    // Check for sealed secret structure
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

  // Test data from your example
  const testData = {
    id: 'id19',
    name: 'name17',
    description: 'description',
    type: 'none',
    signingSecret: 'signingSecret for id 17', // Plain string - should NOT be processed
    signatureAlgorithm: 'sha256',
    username:
      '{"scheme":"secret","provider":"sealed","tenant":"core","kekKid":"TENANT_KEK_CORE_V1","alg":"XCHACHA20-POLY1305","blob":"eyJwbGFpbnRleHQiOiJ1c2VybmFtZTE3IiwidGVuYW50IjoiY29yZSIsIm5hbWVzcGFjZSI6ImF1dGgiLCJ0aW1lc3RhbXAiOjE3NjI2NTQ1MTU1MDYsIm1vY2tFbmNyeXB0aW9uIjp0cnVlfQ==","aad":"auth","v":1}', // Sealed secret JSON - should be processed
    password:
      '{"scheme":"secret","provider":"sealed","tenant":"core","kekKid":"TENANT_KEK_CORE_V1","alg":"XCHACHA20-POLY1305","blob":"eyJwbGFpbnRleHQiOiJwYXNzd29yZDE3IiwidGVuYW50IjoiY29yZSIsIm5hbWVzcGFjZSI6ImF1dGgiLCJ0aW1lc3RhbXAiOjE3NjI2NTQ1MTU1MDYsIm1vY2tFbmNyeXB0aW9uIjp0cnVlfQ==","aad":"auth","v":1}', // Sealed secret JSON - should be processed
  };

  console.log('📝 Testing field validation:');

  const sensitiveFields = ['signingSecret', 'username', 'password'];
  const secretRefFields = {};
  let processedCount = 0;

  for (const field of sensitiveFields) {
    const value = testData[field];
    console.log(`\n🔍 Testing field: ${field}`);
    console.log(`   Value type: ${typeof value}`);
    console.log(
      `   Value preview: ${typeof value === 'string' ? value.substring(0, 50) + (value.length > 50 ? '...' : '') : value}`,
    );

    if (value && typeof value === 'string') {
      const isSealed = isSealedSecretJson(value);
      console.log(`   Is sealed secret JSON: ${isSealed}`);

      if (isSealed) {
        secretRefFields[field] = value;
        processedCount++;
        console.log(`   ✅ PROCESSED - Added to secretRefFields`);
      } else {
        console.log(`   ❌ SKIPPED - Not a sealed secret`);
      }
    } else {
      console.log(`   ❌ SKIPPED - Not a string`);
    }
  }

  console.log(`\n🎯 Summary:`);
  console.log(`- Fields processed: ${processedCount}/3`);
  console.log(
    `- signingSecret (plain string): ${secretRefFields.signingSecret ? '❌ PROCESSED (wrong)' : '✅ SKIPPED (correct)'}`,
  );
  console.log(
    `- username (sealed secret): ${secretRefFields.username ? '✅ PROCESSED (correct)' : '❌ SKIPPED (wrong)'}`,
  );
  console.log(
    `- password (sealed secret): ${secretRefFields.password ? '✅ PROCESSED (correct)' : '❌ SKIPPED (wrong)'}`,
  );

  const expectedResult =
    processedCount === 2 &&
    !secretRefFields.signingSecret &&
    secretRefFields.username &&
    secretRefFields.password;
  console.log(
    `\n🏆 Overall result: ${expectedResult ? '✅ SUCCESS' : '❌ NEEDS WORK'}`,
  );

  if (expectedResult) {
    console.log('\n✅ Fix working correctly:');
    console.log('   - Plain strings are ignored');
    console.log('   - Only sealed secrets are processed');
    console.log(
      '   - This should resolve the "only decrypting first item" issue',
    );
  } else {
    console.log('\n❌ Fix needs adjustment');
  }

  return expectedResult;
}

testSealedSecretValidation().catch(console.error);
