const Redis = require('ioredis');

// Create Redis connection
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  db: 0,
});

async function checkLatestJob() {
  try {
    console.log('🔍 Checking the latest job status...\n');

    // Get job #5 details (the latest one)
    const jobData = await redis.hgetall(
      'development:message-request::MessageRequestQueue:5',
    );

    if (Object.keys(jobData).length === 0) {
      console.log('❌ Job #5 not found');
      return;
    }

    console.log('📄 Job #5 Details:');
    console.log(`  - Name: ${jobData.name || 'N/A'}`);
    console.log(
      `  - Timestamp: ${jobData.timestamp ? new Date(parseInt(jobData.timestamp)).toISOString() : 'N/A'}`,
    );
    console.log(`  - Priority: ${jobData.priority || 'N/A'}`);
    console.log(`  - Delay: ${jobData.delay || 'N/A'}`);
    console.log(`  - Attempts: ${jobData.ats || 'N/A'}`);

    if (jobData.failedReason) {
      console.log(`  - ❌ Failed Reason: ${jobData.failedReason}`);
      console.log(
        `  - Processed On: ${jobData.processedOn ? new Date(parseInt(jobData.processedOn)).toISOString() : 'N/A'}`,
      );
      console.log(
        `  - Finished On: ${jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : 'N/A'}`,
      );
    } else {
      console.log(`  - ✅ Status: Active or completed`);
    }

    if (jobData.data) {
      try {
        const parsedData = JSON.parse(jobData.data);
        console.log(`  - 📊 Job Data:`);
        console.log(
          `    - Message Request ID: ${parsedData.messageRequestId || 'N/A'}`,
        );
        console.log(`    - Tenant: ${parsedData.tenant || 'N/A'}`);

        if (parsedData.tenantConfig) {
          console.log(`    - 🎯 Tenant Config Available: YES`);
          console.log(
            `      - Workspace: ${parsedData.tenantConfig.workspace ? '✅' : '❌'}`,
          );
          console.log(
            `      - Template: ${parsedData.tenantConfig.template ? '✅' : '❌'}`,
          );
          console.log(
            `      - Channel: ${parsedData.tenantConfig.channel ? '✅' : '❌'}`,
          );
          console.log(
            `      - App Config: ${parsedData.tenantConfig.appConfig ? '✅' : '❌'}`,
          );
        } else {
          console.log(
            `    - ❌ Tenant Config: Missing (this would cause workspace_missing error)`,
          );
        }
      } catch (e) {
        console.log(`    - ❌ Failed to parse job data: ${e.message}`);
      }
    }

    // Check failed jobs
    const failedJobs = await redis.lrange(
      'development:message-request::MessageRequestQueue:failed',
      0,
      -1,
    );
    console.log(`\n📊 Failed Jobs Count: ${failedJobs.length}`);

    if (failedJobs.length > 0) {
      console.log('🔍 Recent failed job details:');
      for (
        let i = Math.max(0, failedJobs.length - 2);
        i < failedJobs.length;
        i++
      ) {
        try {
          const failedJobData = JSON.parse(failedJobs[i]);
          console.log(
            `  - Job ${failedJobData.id}: ${failedJobData.failedReason || 'Unknown reason'}`,
          );
        } catch (e) {
          console.log(`  - Failed to parse failed job: ${e.message}`);
        }
      }
    }

    console.log('\n✅ Job status check complete');
  } catch (error) {
    console.error('❌ Error checking job status:', error.message);
  } finally {
    redis.disconnect();
  }
}

checkLatestJob().catch(console.error);
