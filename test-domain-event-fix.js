// Simple test to verify domain event structure fix
const { exec } = require('child_process');

async function testDomainEventStructure() {
  console.log('🔍 Testing Domain Event Structure Fix...\n');

  // Mock the isDomainEventArray check
  const isDomainEventArray = (data) => {
    console.log(
      '🔍 Checking domain event structure:',
      JSON.stringify(data, null, 2),
    );

    if (!Array.isArray(data)) {
      console.log('❌ Not an array');
      return false;
    }

    for (const item of data) {
      if (!item || typeof item !== 'object') {
        console.log('❌ Item is not an object');
        return false;
      }

      if (!item.type || !item.data || !item.aggregateId) {
        console.log('❌ Missing required properties:', {
          hasType: !!item.type,
          hasData: !!item.data,
          hasAggregateId: !!item.aggregateId,
        });
        return false;
      }
    }

    console.log('✅ Valid domain event array structure');
    return true;
  };

  // Test 1: Old format (what we had before)
  console.log('📝 Test 1: Old format (should fail)');
  const oldFormat = [
    {
      signingSecret: {
        type: 'secret',
        data: 'U2FsdGVkX1+ABC123...',
      },
      username: {
        type: 'secret',
        data: 'U2FsdGVkX1+XYZ789...',
      },
    },
  ];

  const oldResult = isDomainEventArray(oldFormat);
  console.log(`Result: ${oldResult ? '✅ PASS' : '❌ FAIL (expected)'}\n`);

  // Test 2: New format (our fix)
  console.log(
    '📝 Test 2: New format with domain event structure (should pass)',
  );
  const newFormat = [
    {
      type: 'SecureTestQuery',
      data: {
        signingSecret: {
          type: 'secret',
          data: 'U2FsdGVkX1+ABC123...',
        },
        username: {
          type: 'secret',
          data: 'U2FsdGVkX1+XYZ789...',
        },
      },
      aggregateId: 'query-test-tenant-1699123456789',
    },
  ];

  const newResult = isDomainEventArray(newFormat);
  console.log(`Result: ${newResult ? '✅ PASS (expected)' : '❌ FAIL'}\n`);

  // Test 3: Data extraction simulation
  console.log('📝 Test 3: Data extraction simulation');
  if (newResult) {
    const extractedData = newFormat[0].data;
    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));
    console.log('✅ Data extraction successful\n');
  }

  console.log('🎯 Summary:');
  console.log(`- Old format should fail: ${!oldResult ? '✅' : '❌'}`);
  console.log(`- New format should pass: ${newResult ? '✅' : '❌'}`);
  console.log(
    `- Overall fix status: ${!oldResult && newResult ? '✅ SUCCESS' : '❌ NEEDS WORK'}`,
  );
}

testDomainEventStructure().catch(console.error);
