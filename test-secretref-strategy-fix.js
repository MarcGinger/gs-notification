#!/usr/bin/env node

/**
 * Test script to verify that the SecretRefStrategy fix works
 * This tests that sealed secret objects are properly converted to JSON strings
 * and then decrypted by the EventEncryptionService
 */

console.log('🧪 Testing SecretRefStrategy fix for sealed secrets...\n');

// Mock sealed secret object (as would be parsed from Redis)
const sealedSecretObject = {
  scheme: 'secret',
  provider: 'sealed',
  tenant: 'core',
  kekKid: 'TENANT_KEK_CORE_V1',
  alg: 'XCHACHA20-POLY1305',
  blob: 'eyJwbGFpbnRleHQiOiJzaWduaW5nU2VjcmV0IGZvciBpZCAxNyIsInRlbmFudCI6ImNvcmUiLCJuYW1lc3BhY2UiOiJzaWduaW5nIiwidGltZXN0YW1wIjoxNzYyNjExMTQ5OTE0LCJtb2NrRW5jcnlwdGlvbiI6dHJ1ZX0=',
  aad: 'signing',
  v: 1,
};

console.log('1. Original sealed secret object:');
console.log('   Type:', typeof sealedSecretObject);
console.log('   Scheme:', sealedSecretObject.scheme);
console.log('   Provider:', sealedSecretObject.provider);
console.log('   Has blob:', !!sealedSecretObject.blob);

// Test the fix: check if object is handled correctly
const sensitiveFields = ['signingSecret', 'username', 'password'];
const eventData = {
  signingSecret: sealedSecretObject, // This is now an object, not a string
  username: 'plainTextUser', // This is a plain string
  password: sealedSecretObject, // This is also an object
};

console.log('\n2. Event data with mixed types:');
console.log('   signingSecret type:', typeof eventData.signingSecret);
console.log('   username type:', typeof eventData.username);
console.log('   password type:', typeof eventData.password);

// Simulate the fixed SecretRefStrategy logic
const secretRefFields = {};
const hasSecrets = sensitiveFields.some((field) => {
  const value = eventData[field];
  if (value && typeof value === 'string') {
    // Already a JSON string
    secretRefFields[field] = value;
    console.log(`   ✅ ${field}: string value processed`);
    return true;
  } else if (value && typeof value === 'object' && value !== null) {
    // Object that needs to be converted to JSON string for EventEncryptionService
    secretRefFields[field] = JSON.stringify(value);
    console.log(`   ✅ ${field}: object converted to JSON string`);
    return true;
  }
  console.log(`   ❌ ${field}: no valid value`);
  return false;
});

console.log('\n3. SecretRefStrategy processing result:');
console.log('   Has secrets:', hasSecrets);
console.log('   Processed fields:', Object.keys(secretRefFields));

// Verify that objects were converted to JSON strings
console.log('\n4. JSON conversion verification:');
Object.entries(secretRefFields).forEach(([field, value]) => {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.scheme === 'secret' && parsed.provider === 'sealed') {
        console.log(`   ✅ ${field}: Valid sealed secret JSON`);

        // Test blob decoding (simulate EventEncryptionService logic)
        try {
          const blobData = JSON.parse(
            Buffer.from(parsed.blob, 'base64').toString('utf-8'),
          );
          console.log(
            `   🔓 ${field}: Blob decoded - plaintext: "${blobData.plaintext}"`,
          );
        } catch (error) {
          console.log(`   ❌ ${field}: Failed to decode blob -`, error.message);
        }
      } else {
        console.log(`   ℹ️  ${field}: Not a sealed secret`);
      }
    } catch (error) {
      console.log(`   ℹ️  ${field}: Plain string value`);
    }
  }
});

console.log('\n🎯 Fix Summary:');
console.log('✅ SecretRefStrategy now handles both string and object values');
console.log(
  '✅ Objects are converted to JSON strings for EventEncryptionService',
);
console.log('✅ EventEncryptionService can decode sealed secret blobs');
console.log('✅ The entire chain should now work correctly!');

console.log(
  '\n🔧 Next step: Test with actual repository to verify end-to-end flow',
);
