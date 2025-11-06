const http = require('http');

// Test data for creating a new SecureTest with sensitive fields
const testSecureTestData = {
  id: 'test-webhook-config-secretref', // Unique ID for this test
  name: 'Test Webhook Config',
  description: 'Test webhook configuration with SecretRef encryption',
  type: 'none',
  signingSecret: 'test-webhook-signing-secret-123', // This should be encrypted as SecretRef
  signatureAlgorithm: 'sha256',
  username: 'test-webhook-user', // This should be encrypted as SecretRef
  password: 'test-webhook-password-456', // This should be encrypted as SecretRef
};

const postData = JSON.stringify(testSecureTestData);

const options = {
  hostname: 'localhost',
  port: 3010,
  path: '/api/v1/notification/webhook-config/secure-tests',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    Authorization:
      'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJDclR5eU44TkozdnVSMDdRbmZ3UVNCNWg5LUtEU2x1Q2cxNFBtMFU4WHE4In0.eyJleHAiOjE3NjI0MjEyOTAsImlhdCI6MTc2MjQxNzY5MCwianRpIjoib25ydHJvOmI4NTNhNzBiLWY2ZTctMzIzZi01OWYwLTk1ZWVlZGNmMWYyYiIsImlzcyI6Imh0dHBzOi8vZ3NrZXljbG9hay11MTk2Njgudm0uZWxlc3Rpby5hcHAvcmVhbG1zL2RlZmF1bHQiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiZTllZGJjYjYtMzMyMC00ZjczLWE4Y2UtYTcwNjViNDRjZTI1IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiYmFja29mZmljZS11c2VyIiwic2lkIjoiODIyZWJiMzUtM2E2Yy1kYWIyLWVkY2QtMjUyMzU3YTFiZTE3IiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJvZmZsaW5lX2FjY2VzcyIsImRlZmF1bHQtcm9sZXMtZGVmYXVsdCIsImFkbWluIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwiLCJ0ZW5hbnRfaWQiOiIxMjM0NSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiTWFyYyBHaW5nZXIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtYXJjLmdpbmdlciIsImdpdmVuX25hbWUiOiJNYXJjIiwiZmFtaWx5X25hbWUiOiJHaW5nZXIiLCJ0ZW5hbnQiOiJjb3JlIiwiZW1haWwiOiJtYXJjLnMuZ2luZ2VyQGdtYWlsLmNvbSJ9.qg0OKSrf5l83XmRmcgvPEGs-nMao1FkwFQ3OceuBTbDqBNZCkThy8n9aTftVQfKG7o02GoArIPcv2osfcr0z3ww-1xBIxmSHE80lJtT5ftTNuLHtMSC3qHVemQvpqo6dIDFnG5TJfvLNXUKMSh7Jh76IT2Msjp8WISyXOwYO0y9tkOOnFduQuTawdJRxdRWH4oEQAavqT3PqZvkbFnX3x5TEKOcVEMUXRnqH2jkFrO1XYeQ5Q4n71cyzIO_HYuA5kmDIwNajojFQooP1ic1JTH22je-0VIrUWhFCrcbAgviYK_sCT-DrDWdd5tDpPGZAwVDq7qVfV5nErcKaMbATBQ',
  },
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== RESPONSE BODY ===');
    try {
      const jsonResponse = JSON.parse(data);
      console.log(JSON.stringify(jsonResponse, null, 2));
    } catch (error) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();

console.log('🚀 Creating new SecureTest with sensitive data...');
console.log('📤 Request payload:', JSON.stringify(testSecureTestData, null, 2));
