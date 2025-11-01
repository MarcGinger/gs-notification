const http = require('http');

// Test data for creating a message request
const testMessageRequest = {
  recipient: 'C09NF3A97KL',
  data: {
    transactionId: '123455',
    amount: 12000,
    customerEmail: 'someone@somewhere.com',
    errorCode: '3004',
  },
  workspaceCode: 'T02NLAU3P62',
  templateCode: 'payment_failure_alert',
  channelCode: 'C09NF3A97KL',
};

const postData = JSON.stringify(testMessageRequest);

const options = {
  hostname: 'localhost',
  port: 3010,
  path: '/api/v1/notification/slack-request/api/v1/message-requests',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    Authorization:
      'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJDclR5eU44TkozdnVSMDdRbmZ3UVNCNWg5LUtEU2x1Q2cxNFBtMFU4WHE4In0.eyJleHAiOjE3NjE5ODkzMjUsImlhdCI6MTc2MTk4NTcyNSwianRpIjoib25ydHJvOjM5ZDVkZjBlLTIwY2UtMjBlNy0zYzgwLTk1OGJkZTc2OTU5NyIsImlzcyI6Imh0dHBzOi8vZ3NrZXljbG9hay11MTk2Njgudm0uZWxlc3Rpby5hcHAvcmVhbG1zL2RlZmF1bHQiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiZTllZGJjYjYtMzMyMC00ZjczLWE4Y2UtYTcwNjViNDRjZTI1IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiYmFja29mZmljZS11c2VyIiwic2lkIjoiZDI1MDVlYzUtYWEwZC01MmZhLTZmMGQtODljN2U5MjQzOGMyIiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJvZmZsaW5lX2FjY2VzcyIsImRlZmF1bHQtcm9sZXMtZGVmYXVsdCIsImFkbWluIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwiLCJ0ZW5hbnRfaWQiOiIxMjM0NSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiTWFyYyBHaW5nZXIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtYXJjLmdpbmdlciIsImdpdmVuX25hbWUiOiJNYXJjIiwiZmFtaWx5X25hbWUiOiJHaW5nZXIiLCJ0ZW5hbnQiOiJjb3JlIiwiZW1haWwiOiJtYXJjLnMuZ2luZ2VyQGdtYWlsLmNvbSJ9.ct5l-bLfBsa9cc1ZMFi0UqJeXN2D6vwTDrJtRu5Xt9lr8l6A-g2NGu8rAOMgMBo1uCyfsT8QYDRYGwreA4JG-wrgv7HzoxbNF5YdIwjvQ7cZC1_TUtuH-t_BR27ox7IZcuyEjnZz2sj_IP6gLxmCRD0LnXAXWdsYih3n-vO_8nnw3D4CkqQpXdYgu3NzoJpdafn5XZSzAqAMrpWuiTHgcwwjW9jxnSUWO8U4b2rmnjvYblMe23CbAnKx-7-jax5GMIpGNgeJLCc1fG0w_bEcRGYAQKRoKXzonZWjmLizmIsA8DRFpA1LUQNUBRclCwIxaALSknHZECkifarifZds2A',
  },
};

console.log('Sending test message request to verify job dispatching...');
console.log('Request data:', testMessageRequest);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);

    if (res.statusCode === 201 || res.statusCode === 200) {
      console.log('✅ Test message request created successfully!');
      console.log(
        '💡 Check the application logs to see if job dispatching worked correctly',
      );
    } else {
      console.log('❌ Test message request failed');
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
  console.log('💡 Make sure the application is running on localhost:3010');
});

req.write(postData);
req.end();
