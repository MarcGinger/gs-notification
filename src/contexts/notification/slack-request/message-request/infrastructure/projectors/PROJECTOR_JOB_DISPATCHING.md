# Projector Job Dispatching Integration

## Overview

The MessageRequestProjector has been enhanced with job dispatching capabilities to integrate Redis projections with async BullMQ job processing. This creates an event-driven architecture where projector events automatically trigger appropriate background jobs.

## Architecture

```
Event Store → Projector → Redis + Job Queue
                      ↓
              [Redis Projection] + [Async Job Dispatch]
```

## Job Dispatching Logic

The projector dispatches jobs based on specific event types after successful Redis operations:

### MessageRequestCreated

- **Trigger**: When a new message request is created
- **Job**: `queueSendMessageRequest` with normal priority
- **Purpose**: Automatically start sending the message
- **Delay**: Immediate (0ms)

### MessageRequestFailed

- **Trigger**: When a message request fails
- **Job**: `queueRetryFailedMessageRequest` with high priority
- **Purpose**: Retry failed message requests
- **Delay**: 5 seconds
- **Reason**: "Event-driven retry after failure"

### MessageRequestUpdated

- **Trigger**: When status changes to 'PENDING'
- **Job**: `queueSendMessageRequest` with normal priority
- **Purpose**: Re-send messages that were updated to pending state
- **Delay**: Immediate (0ms)

## Implementation Details

### Job Dispatching Method

```typescript
private async dispatchJobsForEvent(
  event: ProjectionEvent,
  params: any,
  tenant: string,
): Promise<void>
```

### Key Features

1. **Type Safety**: Uses type assertions with null checks and ESLint suppressions
2. **Error Isolation**: Job dispatching errors don't fail the projection
3. **Conditional Logic**: Jobs are only dispatched for specific conditions
4. **Comprehensive Logging**: All job dispatching is logged for monitoring

### Error Handling

- Job dispatching failures are logged but don't interrupt projection
- Missing message request IDs are handled gracefully with warnings
- All errors include context for debugging

## Integration Points

### Dependencies

- `MessageRequestQueueService` injected into projector constructor
- BullMQ queue registration in `message-request.module.ts`
- Redis backend shared between projections and job queue

### Job Processing

- Jobs are processed by `MessageRequestProcessor`
- Processor handles create, send, and retry operations
- Job results can be monitored through queue statistics

## Benefits

1. **Event-Driven**: Jobs are automatically triggered by domain events
2. **Decoupled**: Projections and job processing are independent
3. **Resilient**: Failures in one system don't affect the other
4. **Observable**: Comprehensive logging for monitoring and debugging
5. **Scalable**: Background processing handles high-throughput scenarios

## Monitoring

### Logging Events

- Job dispatching success/failure
- Event type routing decisions
- Job configuration (priority, delay)
- Error conditions with context

### Queue Metrics

- Available through `MessageRequestQueueService.getQueueInfo()`
- Tracks waiting, active, completed, failed, and delayed jobs
- Can be exposed via health endpoints for monitoring

## Configuration

### Priority Levels

- **Normal Priority**: 0 (create, update scenarios)
- **High Priority**: 1 (retry scenarios)

### Delay Settings

- **Immediate**: 0ms (normal operations)
- **Retry Delay**: 5000ms (failed message retries)

## Future Enhancements

1. **Dynamic Configuration**: Make priorities and delays configurable
2. **Circuit Breaker**: Add circuit breaker pattern for job failures
3. **Batch Processing**: Consider batching job dispatching for high-volume events
4. **Dead Letter Queue**: Handle permanently failed jobs
5. **Metrics**: Add Prometheus metrics for job dispatching
