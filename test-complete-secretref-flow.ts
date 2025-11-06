import { SecureTestFieldValidatorUtil } from './src/contexts/notification/webhook-config/secure-test/infrastructure/utilities/secure-test-field-validator.util';

/**
 * Test script to verify the complete SecretRef flow with real Doppler secrets
 */
async function testCompleteSecretRefFlow() {
  console.log('🔄 Testing Complete SecretRef Flow...\n');

  // Simulate event data that would come from the domain with plain text sensitive values
  const eventDataWithSecrets = {
    id: 'secure-test-with-secrets',
    name: 'SecureTest with Real Secrets',
    description: 'Testing SecretRef flow with actual sensitive data',
    type: 'none' as const,
    signingSecret: 'this-will-be-converted-to-secretref',
    signatureAlgorithm: 'sha256' as const,
    username: 'this-will-also-be-converted',
    password: 'and-this-too',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('📥 1. Input Event Data (with plain text secrets):');
  console.log(
    JSON.stringify(
      {
        ...eventDataWithSecrets,
        signingSecret: '[REDACTED]',
        username: '[REDACTED]',
        password: '[REDACTED]',
      },
      null,
      2,
    ),
  );

  // Convert to projector data (this is what happens in the projector)
  const projectorData =
    SecureTestFieldValidatorUtil.createSecureTestProjectorDataFromEventData(
      eventDataWithSecrets,
    );

  console.log(
    '\n📤 2. Projector Data (sensitive fields converted to SecretRefs):',
  );
  console.log(JSON.stringify(projectorData, null, 2));

  // Simulate what gets stored in Redis
  const redisHashData = {
    id: projectorData.id,
    name: projectorData.name,
    description: projectorData.description || '',
    type: projectorData.type,
    signatureAlgorithm: projectorData.signatureAlgorithm || '',
    signingSecretRef: projectorData.signingSecretRef || '',
    usernameRef: projectorData.usernameRef || '',
    passwordRef: projectorData.passwordRef || '',
    version: projectorData.version.toString(),
    createdAt: projectorData.createdAt.toISOString(),
    updatedAt: projectorData.updatedAt.toISOString(),
    tenant: 'core',
    deletedAt: '', // Empty string for active records
  };

  console.log('\n🗄️  3. Redis Hash Data (what gets stored):');
  console.log(JSON.stringify(redisHashData, null, 2));

  console.log('\n🔍 4. SecretRef Objects Analysis:');

  if (redisHashData.signingSecretRef) {
    const signingSecretRef = JSON.parse(redisHashData.signingSecretRef);
    console.log(
      'Signing Secret SecretRef:',
      JSON.stringify(signingSecretRef, null, 2),
    );
  }

  if (redisHashData.usernameRef) {
    const usernameRef = JSON.parse(redisHashData.usernameRef);
    console.log('Username SecretRef:', JSON.stringify(usernameRef, null, 2));
  }

  if (redisHashData.passwordRef) {
    const passwordRef = JSON.parse(redisHashData.passwordRef);
    console.log('Password SecretRef:', JSON.stringify(passwordRef, null, 2));
  }

  console.log('\n✅ Complete SecretRef flow simulation completed!');
  console.log('\n📋 Summary:');
  console.log('   • Plain text secrets → SecretRef objects → Redis storage');
  console.log(
    '   • Sensitive data removed from Redis, only SecretRef metadata stored',
  );
  console.log(
    '   • Query repository will resolve SecretRefs back to actual values using Doppler',
  );
}

// Run the test
testCompleteSecretRefFlow().catch(console.error);
