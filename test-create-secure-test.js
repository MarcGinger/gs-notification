const http = require('http');

// Test data for creating a new SecureTest with sensitive fields
const testSecureTestData = {
  id: 'test-webhook-config-secretref-new', // Unique ID for this test
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
      'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJDclR5eU44TkozdnVSMDdRbmZ3UVNCNWg5LUtEU2x1Q2cxNFBtMFU4WHE4In0.eyJleHAiOjE3NjI1MTM4NTAsImlhdCI6MTc2MjUxMDI1MCwianRpIjoib25ydHJvOjI2ZDViOWMwLWQ0YWItMjI2ZC1hMTRjLTljMDM5NWI3OTRiOCIsImlzcyI6Imh0dHBzOi8vZ3NrZXljbG9hay11MTk2Njgudm0uZWxlc3Rpby5hcHAvcmVhbG1zL2RlZmF1bHQiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiZTllZGJjYjYtMzMyMC00ZjczLWE4Y2UtYTcwNjViNDRjZTI1IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiYmFja29mZmljZS11c2VyIiwic2lkIjoiMDFhZjA0ZmMtN2JlMy1kYTE5LTY2ODItNGRmNGJlZWI0NjNjIiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJvZmZsaW5lX2FjY2VzcyIsImRlZmF1bHQtcm9sZXMtZGVmYXVsdCIsImFkbWluIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwiLCJ0ZW5hbnRfaWQiOiIxMjM0NSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiTWFyYyBHaW5nZXIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtYXJjLmdpbmdlciIsImdpdmVuX25hbWUiOiJNYXJjIiwiZmFtaWx5X25hbWUiOiJHaW5nZXIiLCJ0ZW5hbnQiOiJjb3JlIiwiZW1haWwiOiJtYXJjLnMuZ2luZ2VyQGdtYWlsLmNvbSJ9.G8LVlWxo-Jy7rNBVgNGfVWzLHCjMqM3wMyLJUthbP5YHpeMnMbZHZmJyuLCzTwG5awxqhQfJ81ltooab9ffFL5GhP2tnLmpyCthUZZtrm7bQTQc8ZmFRfBjodWL6wErbD5ROvxM6iXxIiOqNODIGxyvE2YIzT-rPwaxYq3ESHGcEPVbij9d2pNtbWDuofEq55cbJDq9GZMVfnPPnkqLtwus3P-b19k9JLyPF8N9yR5NGbIPTv2qRvRP-Tu-_oTKr4c0eewvKzeuJBF_DZ2EMWccyS5M34eo_SPMx4dW9dC9xUE1dlUSRZKn6MpFbmjWOc0WBtz23AM_XXU4GEud2vQ',
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
