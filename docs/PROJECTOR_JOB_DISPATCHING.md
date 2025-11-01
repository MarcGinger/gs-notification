# Projector Job Dispatching Integration

## Overview

The MessageRequestProjector has been enhanced with job dispatching capabilities to integrate Redis projections with async BullMQ job processing. This creates an event-driven architecture where projector events automatically trigger appropriate background jobs.

## Architecture

```
Event Store → Projector → Redis + Job Queue
                      ↓
              [Redis Projection] + [Async Job Dispatch]
```

## Refactored Design

### Type Safety & Structure

- **`MessageRequestProjectionParams`**: Replaces `MessageRequestRowParams` with clearer naming
- **Modular Methods**: Job dispatching split into focused, testable methods
- **Parameter Consolidation**: Removed redundant `tenant` parameter (now part of projection params)
- **Validation**: Added comprehensive parameter validation with early returns

### Method Structure

```typescript
dispatchJobsForEvent()           // Main orchestrator
├── handleJobDispatchingByEventType()  // Event type routing
├── dispatchSendMessageJob()           // Send job handler
└── dispatchRetryMessageJob()          // Retry job handler
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

### Refactored Job Dispatching Methods

```typescript
// Main orchestrator with proper type safety
private async dispatchJobsForEvent(
  event: ProjectionEvent,
  params: MessageRequestProjectionParams,
): Promise<void>

// Event type routing with return value indication
private async handleJobDispatchingByEventType(
  eventType: string,
  context: { messageRequestId: string; tenant: string; status?: string },
): Promise<boolean>

// Specialized job dispatchers with consistent logging
private async dispatchSendMessageJob(...): Promise<boolean>
private async dispatchRetryMessageJob(...): Promise<boolean>
```

### Key Improvements

1. **Strong Type Safety**: Uses `MessageRequestProjectionParams` interface instead of `any`
2. **Parameter Consolidation**: Tenant extracted from projection params, removing redundancy
3. **Modular Design**: Separate methods for different job types, improving testability
4. **Return Indicators**: Methods return boolean to indicate if jobs were dispatched
5. **Enhanced Validation**: Comprehensive parameter validation with descriptive logging
6. **Error Isolation**: Job dispatching errors don't fail the projection
7. **Consistent Logging**: Structured logging across all dispatching methods

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

### Architectural Benefits

1. **Event-Driven**: Jobs are automatically triggered by domain events
2. **Decoupled**: Projections and job processing are independent
3. **Resilient**: Failures in one system don't affect the other
4. **Observable**: Comprehensive logging for monitoring and debugging
5. **Scalable**: Background processing handles high-throughput scenarios

### Code Quality Benefits

6. **Type Safety**: Strong typing with `MessageRequestProjectionParams` eliminates runtime errors
7. **Maintainable**: Modular method structure makes code easier to understand and modify
8. **Testable**: Separate methods for different concerns enable focused unit testing
9. **Readable**: Clear method names and parameter validation improve code clarity
10. **Consistent**: Standardized logging and error handling patterns

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
