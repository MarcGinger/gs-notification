# Send Message Worker Service Implementation

## Overview

The `SendMessageWorkerService` has been fully implemented as a BullMQ worker that processes `SendMessageJob` payloads to send Slack messages. This completes the next phase of our messaging infrastructure after establishing the basic BullMQ foundation.

## Core Implementation Features

### 1. Job Processing Pipeline

```typescript
async processJob(job: Job<SendMessageJob>): Promise<void>
```

The main job processor follows this flow:

1. **Data Resolution**: Resolves MessageRequest data from Redis using projection keys
2. **Configuration Fetching**: Fetches workspace, template, channel, and app config data
3. **Validation**: Validates required configurations and bot tokens
4. **Message Processing**: Renders templates and sends messages via Slack API
5. **Outcome Reporting**: Records success/failure back to MessageRequest projection

### 2. Redis Data Resolution

```typescript
private async resolveMessageRequestData(job: Job<SendMessageJob>)
```

- Uses `MessageRequestProjectionKeys.getRedisMessageRequestKey()` for Redis key generation
- Performs `HGETALL` lookup to retrieve stored MessageRequest data
- Handles JSON parsing of `requestData` field with proper type casting
- Returns structured data with workspace codes, template codes, and request payload

### 3. Configuration Resolution

```typescript
private async resolveConfigurations(messageData, tenant)
```

Resolves all required configurations:

- **Workspace**: Via `IWorkspaceQuery.getByCode()`
- **Template**: Via `ITemplateQuery.getByCode()` (optional)
- **Channel**: Via `IChannelQuery.getByCode()` (optional)
- **App Config**: Via `IAppConfigQuery.getByTenant()`

### 4. Slack Message Processing

```typescript
private async processSlackMessage(job, messageData, config, threadTs?)
```

Complete message processing with:

- **Bot Token Validation**: Ensures workspace has valid bot token
- **Channel Resolution**: Determines target channel ID from channel config or workspace default
- **Template Rendering**: Uses `TemplateRendererService` with fallback to raw message blocks
- **Slack API Integration**: Sends messages via `SlackApiService.sendMessage()`
- **Comprehensive Error Handling**: Reports failures with appropriate retry flags

### 5. Outcome Reporting

The service reports all outcomes back to the MessageRequest projection:

#### Success Reporting

```typescript
await this.messageRequestAppPort.recordSent({
  id: job.data.messageRequestId,
  tenant: job.data.tenant,
  slackTs: slackResult.value.ts,
  slackChannel: slackResult.value.channel,
  attempts: 1,
});
```

#### Failure Reporting

```typescript
await this.messageRequestAppPort.recordFailed({
  id: job.data.messageRequestId,
  tenant: job.data.tenant,
  reason: errorMessage,
  retryable: false, // Based on error type
  attempts: 1,
});
```

## Error Handling Strategy

The implementation includes comprehensive error handling for all failure scenarios:

1. **Configuration Errors** (Non-retryable):
   - Missing bot tokens
   - Invalid channel configurations
   - Missing workspace/template/channel references

2. **Slack API Errors** (Retryable based on API response):
   - Network failures
   - Rate limiting
   - Temporary Slack service issues

3. **System Errors** (Retryable):
   - Redis connection issues
   - Template rendering failures
   - Unexpected runtime errors

## Dependencies

The service integrates with all major infrastructure components:

- **BullMQ**: Job queue processing with proper typing
- **Redis**: Data resolution via projection keys
- **Configuration Services**: Workspace, template, channel, app config queries
- **Slack Integration**: `SlackApiService` for API calls
- **Template System**: `TemplateRendererService` for message rendering
- **Outcome Reporting**: `IMessageRequestAppPort` for recording results
- **Logging**: Structured logging with correlation IDs

## Integration Points

### Input

- **SendMessageJob**: Minimal job payload with messageRequestId and tenant
- **Redis Data**: Full MessageRequest data from projection keys

### Output

- **Slack Messages**: Delivered via Slack Web API
- **Outcome Records**: Success/failure reported to MessageRequest projection
- **Audit Logs**: Comprehensive logging for monitoring and debugging

## Next Steps

With the worker service complete, the next priorities are:

1. **End-to-End Testing**: Create integration tests with real Redis and mock Slack API
2. **Performance Optimization**: Add connection pooling and batch processing
3. **Monitoring Integration**: Add metrics and health checks
4. **Error Recovery**: Implement dead letter queue handling
5. **Scalability**: Configure queue concurrency and worker scaling

## Technical Notes

- Uses proper TypeScript typing throughout
- Follows NestJS patterns for dependency injection
- Implements Result<T> pattern for error handling
- Maintains correlation context for distributed tracing
- Supports both templated and raw message block delivery
- Handles thread replies via threadTs parameter
