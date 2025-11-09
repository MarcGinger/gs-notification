/**
 * Test Base64 Blob Decoding for Sealed Secrets
 */

// Your actual blob data from the sealed secret
const signingSecretBlob =
  'eyJwbGFpbnRleHQiOiJzaWduaW5nU2VjcmV0IGZvciBpZCAxNyIsInRlbmFudCI6ImNvcmUiLCJuYW1lc3BhY2UiOiJzaWduaW5nIiwidGltZXN0YW1wIjoxNzYyNjA5MjUwNDA0LCJtb2NrRW5jcnlwdGlvbiI6dHJ1ZX0=';
const usernameBlob =
  'eyJwbGFpbnRleHQiOiJ1c2VybmFtZTE3IiwidGVuYW50IjoiY29yZSIsIm5hbWVzcGFjZSI6ImF1dGgiLCJ0aW1lc3RhbXAiOjE3NjI2MDkyNTA0MDQsIm1vY2tFbmNyeXB0aW9uIjp0cnVlfQ==';
const passwordBlob =
  'eyJwbGFpbnRleHQiOiJwYXNzd29yZDE3IiwidGVuYW50IjoiY29yZSIsIm5hbWVzcGFjZSI6ImF1dGgiLCJ0aW1lc3RhbXAiOjE3NjI2MDkyNTA0MDQsIm1vY2tFbmNyeXB0aW9uIjp0cnVlfQ==';

console.log('🔓 Testing Base64 Blob Decoding');
console.log('='.repeat(50));

function decodeBlob(blob, fieldName) {
  try {
    const decoded = Buffer.from(blob, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    console.log(`📋 ${fieldName}:`);
    console.log(`  - Plaintext: "${parsed.plaintext}"`);
    console.log(`  - Mock Encryption: ${parsed.mockEncryption}`);
    console.log(`  - Tenant: ${parsed.tenant}`);
    console.log(`  - Namespace: ${parsed.namespace}`);
    console.log('');

    return parsed.plaintext;
  } catch (error) {
    console.log(`❌ Failed to decode ${fieldName}: ${error.message}`);
    return null;
  }
}

console.log('Decoding your sealed secret blobs:');
console.log('');

const decodedSigningSecret = decodeBlob(signingSecretBlob, 'Signing Secret');
const decodedUsername = decodeBlob(usernameBlob, 'Username');
const decodedPassword = decodeBlob(passwordBlob, 'Password');

console.log('🎯 Expected API Response (after fix):');
console.log(
  JSON.stringify(
    {
      id: 'id18',
      name: 'name17',
      description: 'description',
      type: 'none',
      signingSecret: decodedSigningSecret,
      signatureAlgorithm: 'sha256',
      username: decodedUsername,
      password: decodedPassword,
    },
    null,
    2,
  ),
);

console.log('');
console.log('✅ The fix should now return these decrypted values!');
console.log('📝 Mock encryption allows direct extraction from base64 blobs');
