import { SecureTestFieldValidatorUtil } from './src/contexts/notification/webhook-config/secure-test/infrastructure/utilities/secure-test-field-validator.util';

/**
 * Test script to verify SecretRef projection logic
 */
async function testSecretRefProjection() {
  console.log('🧪 Testing SecretRef projection logic...\n');

  // Test 1: Event data with plain text values (legacy format)
  const plainTextEventData = {
    id: 'test-id',
    name: 'Test SecureTest',
    description: 'Test description',
    type: 'none' as const,
    signingSecret: 'secret-webhook-signing-key',
    signatureAlgorithm: 'sha256' as const,
    username: 'webhook-user',
    password: 'webhook-password',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('📥 Input (Plain Text Event Data):');
  console.log(JSON.stringify(plainTextEventData, null, 2));

  // Convert to projector data
  const projectorData =
    SecureTestFieldValidatorUtil.createSecureTestProjectorDataFromEventData(
      plainTextEventData,
    );

  console.log('\n📤 Output (Projector Data with SecretRefs):');
  console.log(JSON.stringify(projectorData, null, 2));

  // Test 2: Verify SecretRef objects are created
  console.log('\n🔍 Parsed SecretRef Objects:');

  if (projectorData.signingSecretRef) {
    const signingSecretRef = JSON.parse(projectorData.signingSecretRef);
    console.log('Signing Secret SecretRef:', signingSecretRef);
  }

  if (projectorData.usernameRef) {
    const usernameRef = JSON.parse(projectorData.usernameRef);
    console.log('Username SecretRef:', usernameRef);
  }

  if (projectorData.passwordRef) {
    const passwordRef = JSON.parse(projectorData.passwordRef);
    console.log('Password SecretRef:', passwordRef);
  }

  console.log('\n✅ SecretRef projection test completed!');
}

// Run the test
testSecretRefProjection().catch(console.error);
