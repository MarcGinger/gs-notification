const Redis = require('ioredis');

// Create Redis connection (using same config as the app)
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  db: 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

async function monitorRedisQueues() {
  try {
    console.log('🔍 Monitoring Redis for BullMQ queues and jobs...\n');

    // Get all keys to see what's in Redis
    const allKeys = await redis.keys('*');
    console.log('📋 All Redis keys:');
    allKeys.forEach((key) => console.log(`  - ${key}`));
    console.log(`\nTotal keys: ${allKeys.length}\n`);

    // Look for BullMQ queue patterns
    const queueKeys = allKeys.filter(
      (key) =>
        key.includes('bull') ||
        key.includes('Queue') ||
        key.includes('message-request') ||
        key.includes('MessageRequest'),
    );

    console.log('🎯 Queue-related keys:');
    if (queueKeys.length === 0) {
      console.log('  ❌ No queue-related keys found');
    } else {
      queueKeys.forEach((key) => console.log(`  - ${key}`));
    }
    console.log('');

    // Check for specific MessageRequestQueue patterns
    const messageRequestKeys = allKeys.filter((key) =>
      key.toLowerCase().includes('messagerequest'),
    );

    console.log('🎯 MessageRequest-specific keys:');
    if (messageRequestKeys.length === 0) {
      console.log('  ❌ No MessageRequest queue keys found');
    } else {
      messageRequestKeys.forEach((key) => console.log(`  - ${key}`));
    }
    console.log('');

    // Check for any jobs with our message request ID
    const testMessageId = '8e6718b3-2d61-4a54-ba73-3bbac27d5190';
    const jobKeys = allKeys.filter((key) => key.includes(testMessageId));

    console.log(`🎯 Keys containing message request ID (${testMessageId}):`);
    if (jobKeys.length === 0) {
      console.log('  ❌ No keys found with the test message request ID');
    } else {
      jobKeys.forEach((key) => console.log(`  - ${key}`));
    }
    console.log('');

    // Check environment-prefixed keys (from the app config)
    const envKeys = allKeys.filter(
      (key) =>
        key.startsWith('development:') ||
        key.startsWith('dev:') ||
        key.startsWith('local:'),
    );

    console.log('🎯 Environment-prefixed keys:');
    if (envKeys.length === 0) {
      console.log('  ❌ No environment-prefixed keys found');
    } else {
      envKeys.forEach((key) => console.log(`  - ${key}`));

      // Check if any of these are message-request related
      const envMessageRequestKeys = envKeys.filter((key) =>
        key.includes('message-request'),
      );

      if (envMessageRequestKeys.length > 0) {
        console.log('\n  📋 Environment + message-request keys:');
        envMessageRequestKeys.forEach((key) => console.log(`    - ${key}`));
      }
    }
    console.log('');

    // Try to get details of some queue keys
    console.log('🔍 Examining queue structures...');
    for (const key of queueKeys.slice(0, 5)) {
      // Limit to first 5 to avoid spam
      try {
        const type = await redis.type(key);
        console.log(`  📄 ${key} (${type})`);

        if (type === 'hash') {
          const hashData = await redis.hgetall(key);
          console.log(`    Hash fields: ${Object.keys(hashData).join(', ')}`);
        } else if (type === 'list') {
          const listLength = await redis.llen(key);
          console.log(`    List length: ${listLength}`);
        } else if (type === 'zset') {
          const zsetLength = await redis.zcard(key);
          console.log(`    Sorted set length: ${zsetLength}`);
        }
      } catch (error) {
        console.log(`    ❌ Error examining ${key}: ${error.message}`);
      }
    }

    console.log('\n✅ Redis monitoring complete');
  } catch (error) {
    console.error('❌ Error monitoring Redis:', error.message);
  } finally {
    redis.disconnect();
  }
}

// Run the monitoring
monitorRedisQueues().catch(console.error);
