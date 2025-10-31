# BullMQ Integration for Message Requests

## Overview

The message-request module now includes BullMQ integration for asynchronous job processing. This enables reliable, scalable processing of message request operations with features like:

- **Retry Logic**: Exponential backoff for failed jobs
- **Job Persistence**: Jobs are stored in Redis for reliability
- **Priority Processing**: Support for job prioritization
- **Delayed Jobs**: Schedule jobs to run at specific times
- **Monitoring**: Built-in metrics and logging

## Queue Configuration

The `MessageRequestQueue` is configured in the infrastructure module with:

```typescript
{
  name: 'MessageRequestQueue',
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    delay: 0, // Process immediately by default
  },
}
```

## Services

### MessageRequestQueueService

Service for adding jobs to the queue:

```typescript
// Inject the service
constructor(
  private readonly queueService: MessageRequestQueueService,
) {}

// Queue a message request creation
await this.queueService.queueCreateMessageRequest(user, request, {
  idempotencyKey: 'unique-key',
  delay: 5000, // Delay 5 seconds
  priority: 1, // Higher priority
});

// Queue message sending
await this.queueService.queueSendMessageRequest(
  messageRequestId,
  tenant,
  { delay: 1000 }
);

// Queue retry for failed requests
await this.queueService.queueRetryFailedMessageRequest(
  messageRequestId,
  tenant,
  'timeout_error',
  { delay: 30000 }
);
```

### MessageRequestProcessor

Handles job processing with methods:

- `handleCreateMessageRequest()` - Process message request creation
- `handleSendMessageRequest()` - Send messages via Slack API
- `handleRetryFailedMessageRequest()` - Retry failed operations

## Job Types

```typescript
export interface MessageRequestJobs {
  'create-message-request': {
    user: IUserToken;
    request: CreateMessageRequestRequest;
    options?: {
      idempotencyKey?: string;
    };
  };
  'send-message-request': {
    messageRequestId: string;
    tenant: string;
  };
  'retry-failed-message-request': {
    messageRequestId: string;
    tenant: string;
    retryReason: string;
  };
}
```

## Usage Examples

### In Controllers

```typescript
import { MessageRequestQueueService } from '../infrastructure/services';

@Controller('message-requests')
export class MessageRequestController {
  constructor(private readonly queueService: MessageRequestQueueService) {}

  @Post('async')
  async createAsync(
    @CurrentUser() user: IUserToken,
    @Body() request: CreateMessageRequestRequest,
  ) {
    const jobId = await this.queueService.queueCreateMessageRequest(
      user,
      request,
    );

    return {
      message: 'Message request queued for processing',
      jobId,
    };
  }
}
```

### In Application Services

```typescript
export class MessageRequestApplicationService {
  constructor(private readonly queueService: MessageRequestQueueService) {}

  async processAsyncCreation(
    user: IUserToken,
    request: CreateMessageRequestRequest,
  ) {
    // Queue the job instead of processing synchronously
    const jobId = await this.queueService.queueCreateMessageRequest(
      user,
      request,
    );

    return {
      status: 'queued',
      jobId,
      estimatedProcessingTime: '2-5 seconds',
    };
  }
}
```

## Monitoring

Get queue statistics:

```typescript
const stats = await this.queueService.getQueueInfo();
console.log('Queue Stats:', {
  waiting: stats.waiting,
  active: stats.active,
  completed: stats.completed,
  failed: stats.failed,
  delayed: stats.delayed,
});
```

## Redis Configuration

The queue uses the Redis configuration from `AppConfigUtil.getRedisConfig().url` with environment-specific prefixes for key isolation.

## Next Steps

1. **Worker Deployment**: Consider running workers in separate processes/containers for better scalability
2. **Slack Integration**: Implement actual Slack API calls in `handleSendMessageRequest`
3. **Dashboard**: Add BullMQ dashboard for job monitoring
4. **Metrics**: Integrate with your metrics system for queue monitoring
5. **Dead Letter Queue**: Handle permanently failed jobs
