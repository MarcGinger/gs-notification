# Redis Key Architecture Documentation

## Overview

The notification system uses a **dual Redis key architecture** that serves different purposes:

1. **Business Data Keys** - Store actual projection data with descriptive formats
2. **Performance Optimization Keys** - Store metadata for duplicate detection and caching

## 1. Business Data Keys (Main Projections)

### Key Format

```
notification.slack:v1:{tenantId}:workspace:{workspaceId}
notification.slack:v1:{tenantId}:idx:workspace:list
notification.slack:v1:{tenantId}:idx:workspace:by-category:{category}
```

### Purpose

- Store the actual projected workspace data
- Provide human-readable, descriptive key patterns
- Support business queries and data retrieval
- Follow domain-driven design principles

### Implementation

Located in: `src/contexts/notification/slack-config/workspace/workspace-projection-keys.ts`

```typescript
// Example usage
static getRedisWorkspaceKey(tenantId: string, workspaceId: string): string {
  return `${this.REDIS_KEY_PREFIX}:${this.REDIS_VERSION}:{${tenantId}}:workspace:${workspaceId}`;
}
```

### Key Components

- `notification.slack` - Service identifier (module namespace)
- `v1` - API version for backward compatibility
- `{tenantId}` - Cluster-safe hash tag for Redis Cluster
- `workspace` - Entity type
- `{workspaceId}` - Specific entity identifier

## 2. Performance Optimization Keys

### Version Hints (`notification.slack:pp:ver:*`)

#### Key Format

```
notification.slack:pp:ver:{tenantId}:workspace:{workspaceId}
```

#### Purpose

- Store only the version number (revision) of the last processed event
- Enable quick duplicate detection without reading full projection data
- Optimize projector performance by skipping already processed events

#### TTL Configuration

```typescript
// Default: 7 days (configurable)
VERSION_HINT_TTL_SECONDS: 7 * 24 * 60 * 60;
```

#### Implementation

```typescript
// Check if event should be skipped
const skipDueToVersionHint = await CacheOptimizationUtils.checkVersionHint(
  this.redis,
  tenant,
  'workspace',
  workspaceId,
  revision, // Incoming event revision
);

if (skipDueToVersionHint) {
  return; // Skip processing - already handled
}

// After successful processing, update version hint
await CacheOptimizationUtils.updateVersionHint(
  this.redis,
  tenant,
  'workspace',
  workspaceId,
  revision, // Mark this revision as processed
);
```

### Deduplication Keys (`notification.slack:pd:dup:*`)

#### Key Format

```
notification.slack:pd:dup:{tenantId}:{streamId}:{revision}
```

#### Purpose

- Prevent duplicate processing of the same event
- Handle race conditions in distributed projector deployments
- Provide atomic "process once" guarantees

#### TTL Configuration

```typescript
// Default: 48 hours (configurable)
DEDUP_TTL_HOURS: 48;
```

## 3. Checkpoint Keys (Module-Namespaced)

### Key Format

```
### Key Format
```

notification.slack:checkpoint:{environment}:{subscriptionGroup}

```

```

### Purpose

- Store EventStore subscription positions for resumption after restarts
- Track progress of each projection subscription
- Enable distributed projector coordination

### Example Keys

```
notification.slack:checkpoint:dev:workspace-projection
notification.slack:checkpoint:prod:workspace-projection
```

### Module Isolation Benefits

- **Before**: `dev:checkpoint:workspace-projection` (collision risk between modules)
- **After**: `notification.slack:checkpoint:dev:workspace-projection` (module-safe)
- **Multiple Modules**: Each gets own checkpoint namespace (e.g., `user.profile:checkpoint:dev:*`)

### Implementation

Located in: `src/contexts/notification/slack-config/projector.config.ts`

```typescript
// Module-specific checkpoint store factory
static createCheckpointStoreFactory() {
  return (redis: Redis, logger: Logger, envPrefix: string = '') => {
    return new RedisCheckpointStore(
      redis,
      logger,
      envPrefix,
      this.MODULE_NAMESPACE, // 'notification.slack'
    );
  };
}
```

## 4. Configuration Management

### TTL Settings

All TTL values are configurable through `ProjectorConfig`:

```typescript
export const ProjectorConfig = {
  // Version hints (performance optimization)
  VERSION_HINT_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days

  // Deduplication (race condition protection)
  DEDUP_TTL_HOURS: 48, // 48 hours

  // Soft deletes (tombstone cleanup)
  DELETE_TTL_SECONDS: 30 * 24 * 60 * 60, // 30 days
};
```

### Environment-Specific Overrides

```typescript
// Example: Shorter TTLs for development
const devConfig = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: 60 * 60, // 1 hour
  dedupTtlHours: 2, // 2 hours
});
```

### Disabling TTL

```typescript
// Set to null for no TTL (keys persist indefinitely)
const noTtlConfig = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: null,
});
```

## 4. Duplicate Detection Flow

### How It Works

1. **Event Arrives**: Projector receives event with `revision` number
2. **Version Hint Check**: Quick check if `revision <= stored_version`
   ```typescript
   const skipDueToVersionHint = await CacheOptimizationUtils.checkVersionHint(
     redis,
     tenant,
     'workspace',
     workspaceId,
     revision,
   );
   ```
3. **Skip if Already Processed**: If version hint indicates event was processed, skip
4. **Deduplication Check**: For race condition protection (optional)
5. **Process Event**: Apply event to projection data
6. **Update Version Hint**: Store new revision number for future checks
   ```typescript
   await CacheOptimizationUtils.updateVersionHint(
     redis,
     tenant,
     'workspace',
     workspaceId,
     revision,
   );
   ```

### Performance Benefits

- **Fast Skips**: Version hint check is O(1) Redis GET operation
- **Reduced Load**: Avoid processing same events multiple times
- **Memory Efficient**: Store only revision numbers, not full data
- **Configurable TTL**: Balance performance vs. memory usage

## 5. Key Migration Strategy

### Old vs New Formats

#### Legacy Keys (Being Phased Out)

```
notification:workspace-projector:{tenantId}:workspace:{workspaceId}
notification:workspace-projector:{tenantId}:workspace-index
```

#### Current Keys

```
notification.slack:v1:{tenantId}:workspace:{workspaceId}
notification.slack:v1:{tenantId}:idx:workspace:list
```

### Migration Helpers

The `WorkspaceProjectionKeys` class provides migration helpers:

```typescript
// Get old key patterns for cleanup
static getOldKeyPatterns(): string[] {
  return [
    'notification:workspace-projector:*',
    'notification:workspace-index:*',
    'pp:*:workspace:*',      // Note: pp:ver:* keys should NOT be migrated
    'ver:*:workspace:*',     // These are intentionally different
  ];
}
```

⚠️ **Important**: Do NOT migrate `pp:ver:*` keys to new format - they serve a different purpose!

## 6. Monitoring and Maintenance

### Health Checks

```typescript
const health = await CacheOptimizationUtils.healthCheck(redis);
console.log(
  `Redis connected: ${health.connected}, latency: ${health.latencyMs}ms`,
);
```

### Cleanup Operations

```typescript
// Clean up expired deduplication keys
const deletedCount = await CacheOptimizationUtils.cleanupExpiredDedupKeys(
  redis,
  tenantId,
  batchSize: 100
);
```

### Metrics Collection

```typescript
interface CacheMetrics {
  dedupHits: number; // Events skipped due to dedup
  dedupMisses: number; // Events processed (not duplicates)
  versionHintHits: number; // Events skipped due to version hints
  versionHintMisses: number; // Events processed (new revisions)
  totalOperations: number;
}
```

## 7. Best Practices

### Key Design

- ✅ Use cluster-safe hash tags: `{tenantId}`
- ✅ Include version in business keys: `v1`
- ✅ Keep optimization keys compact: `pp:ver:`
- ✅ Use descriptive business key formats

### TTL Management

- ✅ Set appropriate TTLs based on event frequency
- ✅ Use longer TTLs for version hints (7 days default)
- ✅ Use shorter TTLs for dedup keys (48 hours default)
- ✅ Consider setting TTL to `null` for critical keys

### Performance

- ✅ Always check version hints before expensive operations
- ✅ Use batch operations for multiple updates
- ✅ Implement proper error handling for Redis operations
- ✅ Monitor cache hit rates and adjust TTLs accordingly

## 8. Troubleshooting

### Common Issues

#### Old Format Keys Still Appearing

- **Cause**: Cache optimization system intentionally uses `pp:ver:*` format
- **Solution**: This is expected behavior - don't migrate these keys

#### Version Hints Not Working

- **Check**: TTL configuration
- **Check**: Key format matches between read/write operations
- **Check**: Redis connectivity and permissions

#### High Memory Usage

- **Solution**: Reduce TTL values
- **Solution**: Implement regular cleanup jobs
- **Solution**: Monitor key expiration patterns

### Debugging Commands

```bash
# Check version hint keys
redis-cli KEYS "notification.slack:pp:ver:*"

# Check business data keys
redis-cli KEYS "notification.slack:v1:*"

# Check checkpoint keys
redis-cli KEYS "notification.slack:checkpoint:*"

# Check TTL for specific key
redis-cli TTL "notification.slack:pp:ver:{tenant}:workspace:{workspaceId}"

# Get version hint value
redis-cli GET "notification.slack:pp:ver:{tenant}:workspace:{workspaceId}"

# Get checkpoint position
redis-cli HGETALL "notification.slack:checkpoint:dev:workspace-projection"
```

## Summary

This dual-key architecture provides:

- **Business Data**: Descriptive, versioned keys for actual projection data
- **Performance Optimization**: Module-namespaced keys for duplicate detection
- **Module Isolation**: Prevents key collisions between different modules
- **Configurable TTLs**: Environment-specific lifetime management
- **Migration Support**: Smooth transition from legacy key formats
- **Monitoring**: Built-in health checks and metrics collection

### Key Architectural Benefits

1. **No Module Collisions**: Each module gets its own namespace (e.g., `notification.slack:`, `user.profile:`)
2. **Shared Infrastructure**: Common projection utilities work across all modules
3. **Environment Flexibility**: Development, staging, and production configurations
4. **Performance Optimized**: Version hints and deduplication for high-throughput scenarios

The two systems work together to provide both **human-readable business keys** and **high-performance optimization**, while ensuring **module isolation** and preventing Redis key collisions.
