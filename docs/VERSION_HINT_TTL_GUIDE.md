# Version Hint TTL Configuration Guide

## Quick Configuration

### 1. Default Settings (Production)

```typescript
// Current defaults in projector-config.ts
VERSION_HINT_TTL_SECONDS: 7 * 24 * 60 * 60; // 7 days
DEDUP_TTL_HOURS: 48; // 48 hours
DELETE_TTL_SECONDS: 30 * 24 * 60 * 60; // 30 days
```

### 2. Environment-Specific Overrides

#### Development Environment (Shorter TTLs)

```typescript
const devConfig = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: 60 * 60, // 1 hour
  dedupTtlHours: 2, // 2 hours
  deleteTtlSeconds: 24 * 60 * 60, // 1 day
});
```

#### High-Volume Production (Longer TTLs)

```typescript
const highVolumeConfig = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: 14 * 24 * 60 * 60, // 14 days
  dedupTtlHours: 72, // 72 hours
  deleteTtlSeconds: 90 * 24 * 60 * 60, // 90 days
});
```

#### Memory-Constrained Environment (Shorter TTLs)

```typescript
const memoryConstrainedConfig = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: 24 * 60 * 60, // 1 day
  dedupTtlHours: 12, // 12 hours
  deleteTtlSeconds: 7 * 24 * 60 * 60, // 7 days
});
```

#### No TTL (Keys Persist Forever)

```typescript
const noTtlConfig = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: null, // No expiration
  dedupTtlHours: null, // No expiration
  deleteTtlSeconds: null, // No expiration
});
```

## 3. TTL Selection Guidelines

### Version Hint TTL (`pp:ver:*` keys)

| Scenario                 | Recommended TTL | Reasoning                                 |
| ------------------------ | --------------- | ----------------------------------------- |
| **Low Event Frequency**  | 14 days         | Events rare, longer cache beneficial      |
| **High Event Frequency** | 3-7 days        | Events frequent, shorter cache sufficient |
| **Development/Testing**  | 1 hour          | Fast iteration, frequent resets           |
| **Critical Production**  | No TTL (`null`) | Never lose optimization data              |
| **Memory Constrained**   | 1 day           | Minimize Redis memory usage               |

### Deduplication TTL (`pd:dup:*` keys)

| Scenario                    | Recommended TTL | Reasoning                             |
| --------------------------- | --------------- | ------------------------------------- |
| **Standard Production**     | 48 hours        | Covers typical replay scenarios       |
| **High Replay Risk**        | 72 hours        | Extended protection against replays   |
| **Development**             | 2 hours         | Fast cleanup, frequent restarts       |
| **Event Sourcing Recovery** | 7 days          | Long replay scenarios during recovery |

## 4. Runtime Configuration

### Environment Variables

```bash
# Set in your environment
export VERSION_HINT_TTL_SECONDS=604800  # 7 days
export DEDUP_TTL_HOURS=48                # 48 hours
export DELETE_TTL_SECONDS=2592000        # 30 days
```

### Configuration Service

```typescript
// In your configuration service
class ConfigService {
  getProjectorConfig(): typeof ProjectorConfig {
    return ProjectorConfigBuilder.build({
      versionHintTtlSeconds: this.getNumber('VERSION_HINT_TTL_SECONDS'),
      dedupTtlHours: this.getNumber('DEDUP_TTL_HOURS'),
      deleteTtlSeconds: this.getNumber('DELETE_TTL_SECONDS'),
    });
  }
}
```

### Dynamic Configuration Updates

```typescript
// Update TTL for existing keys (requires admin operation)
async function updateExistingKeyTtl(
  redis: Redis,
  pattern: string,
  newTtl: number,
) {
  const keys = await redis.keys(pattern);
  const pipeline = redis.pipeline();

  for (const key of keys) {
    pipeline.expire(key, newTtl);
  }

  await pipeline.exec();
}

// Example usage
await updateExistingKeyTtl(redis, 'pp:ver:*', 14 * 24 * 60 * 60); // 14 days
```

## 5. Monitoring TTL Effectiveness

### Key Metrics to Track

```typescript
interface TtlMetrics {
  keyCount: number; // Total keys with TTL
  avgTtl: number; // Average TTL remaining
  expiredCount: number; // Keys expired in last period
  hitRate: number; // Cache hit rate
  memoryUsage: number; // Redis memory for these keys
}
```

### Redis Commands for Monitoring

```bash
# Check TTL for specific patterns
redis-cli --scan --pattern "pp:ver:*" | head -10 | xargs -I {} redis-cli TTL {}

# Count keys by pattern
redis-cli EVAL "return #redis.call('keys', 'pp:ver:*')" 0

# Memory usage by key pattern (requires Redis 4.0+)
redis-cli --scan --pattern "pp:ver:*" | head -10 | xargs -I {} redis-cli MEMORY USAGE {}
```

### Automated Monitoring Script

```typescript
async function monitorTtlHealth(redis: Redis): Promise<TtlMetrics> {
  const keys = await redis.keys('pp:ver:*');
  const pipeline = redis.pipeline();

  keys.forEach((key) => {
    pipeline.ttl(key);
    pipeline.memory('usage', key);
  });

  const results = await pipeline.exec();

  const ttls =
    results
      ?.filter((_, i) => i % 2 === 0)
      .map((r) => r[1] as number)
      .filter((ttl) => ttl > 0) || [];

  return {
    keyCount: keys.length,
    avgTtl: ttls.reduce((a, b) => a + b, 0) / ttls.length || 0,
    expiredCount: keys.length - ttls.length,
    hitRate: 0, // Calculate from application metrics
    memoryUsage: 0, // Sum from memory usage results
  };
}
```

## 6. Troubleshooting TTL Issues

### Problem: High Memory Usage

```typescript
// Solution 1: Reduce TTL
const config = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: 24 * 60 * 60, // Reduce from 7 days to 1 day
});

// Solution 2: Implement cleanup job
setInterval(
  async () => {
    await CacheOptimizationUtils.cleanupExpiredDedupKeys(redis, tenantId);
  },
  60 * 60 * 1000,
); // Every hour
```

### Problem: Poor Cache Hit Rate

```typescript
// Solution: Increase TTL
const config = ProjectorConfigBuilder.build({
  versionHintTtlSeconds: 14 * 24 * 60 * 60, // Increase to 14 days
});
```

### Problem: Keys Expiring Too Quickly

```typescript
// Check current TTL
const currentTtl = await redis.ttl('pp:ver:{tenant}:workspace:{workspaceId}');
console.log(`Current TTL: ${currentTtl} seconds`);

// Extend TTL if needed
if (currentTtl < 24 * 60 * 60) {
  // Less than 1 day
  await redis.expire(key, 7 * 24 * 60 * 60); // Set to 7 days
}
```

## 7. Best Practices

### TTL Configuration

- ✅ Start with default values and adjust based on metrics
- ✅ Use shorter TTLs in development for faster iteration
- ✅ Consider event frequency when setting version hint TTL
- ✅ Set dedup TTL based on maximum expected replay duration
- ✅ Use environment-specific configurations

### Monitoring

- ✅ Track cache hit rates to optimize TTL values
- ✅ Monitor Redis memory usage trends
- ✅ Set up alerts for unusual expiration patterns
- ✅ Log TTL effectiveness metrics

### Operations

- ✅ Validate TTL settings in staging before production
- ✅ Have procedures for emergency TTL adjustments
- ✅ Document TTL choices and rationale
- ✅ Regular review and optimization of TTL settings

## 8. Example Implementation

```typescript
// Complete example with monitoring
class WorkspaceProjectorService {
  private config: typeof ProjectorConfig;

  constructor() {
    // Environment-specific configuration
    this.config = ProjectorConfigBuilder.build({
      versionHintTtlSeconds:
        process.env.NODE_ENV === 'development'
          ? 60 * 60 // 1 hour for dev
          : 7 * 24 * 60 * 60, // 7 days for prod
      dedupTtlHours:
        process.env.NODE_ENV === 'development'
          ? 2 // 2 hours for dev
          : 48, // 48 hours for prod
    });
  }

  async projectEvent(event: Event) {
    // Use configured TTL values
    const skipDueToVersionHint = await CacheOptimizationUtils.checkVersionHint(
      this.redis,
      event.tenant,
      'workspace',
      event.workspaceId,
      event.revision,
    );

    if (skipDueToVersionHint) {
      this.metrics.incrementVersionHintHit();
      return;
    }

    // Process event...

    // Update with configured TTL
    await CacheOptimizationUtils.updateVersionHint(
      this.redis,
      event.tenant,
      'workspace',
      event.workspaceId,
      event.revision,
      this.config.VERSION_HINT_TTL_SECONDS,
    );
  }
}
```

This guide provides everything you need to configure and optimize your TTL settings for different environments and use cases!
