// ⚠️ PRODUCTION-READY: Redis Cluster-Safe + EVALSHA + Configurable TTLs
// ✅ Hash-tag enforcement for key locality
// ✅ ioredis.defineCommand for EVALSHA optimization
// ✅ Configurable TTLs (no hardcoded values)
// ✅ Atomic operations with single-slot execution

import type { Redis } from 'ioredis';

export const RedisAtomicScripts = {
  upsert: {
    numberOfKeys: 2,
    lua: `
      local key = KEYS[1]    -- Must contain {tenantId} hash-tag
      local zkey = KEYS[2]   -- Must contain same {tenantId} hash-tag
      local entityId = ARGV[1]
      local newVersion = tonumber(ARGV[2])
      local updatedAtMs = tonumber(ARGV[3])
      -- Hash field pairs start at ARGV[4] as [field, value, field, value, ...]
      
      local currentVersion = tonumber(redis.call('HGET', key, 'version') or "-1")
      if currentVersion and currentVersion >= newVersion then
        return 0 -- STALE_OCC: optimistic concurrency conflict
      end
      
      -- Apply all field updates atomically
      for i = 4, #ARGV, 2 do
        redis.call('HSET', key, ARGV[i], ARGV[i+1])
      end
      
      -- Update index with timestamp for ordering
      redis.call('ZADD', zkey, updatedAtMs, entityId)
      return 1 -- APPLIED
    `,
  },

  softDelete: {
    numberOfKeys: 2,
    lua: `
      local key = KEYS[1]    -- Entity hash key with {tenantId}
      local zkey = KEYS[2]   -- Index sorted set with same {tenantId}
      local entityId = ARGV[1]
      local deletedAtIso = ARGV[2]
      local ttl = tonumber(ARGV[3])  -- ✅ Configurable TTL (no hardcoded 2592000)
      
      -- Mark as deleted with timestamp
      redis.call('HSET', key, 'deletedAt', deletedAtIso)
      -- Set TTL for cleanup (configurable)
      redis.call('EXPIRE', key, ttl)
      -- Remove from active entity index
      redis.call('ZREM', zkey, entityId)
      return 1 -- APPLIED
    `,
  },
} as const;

// ✅ EVALSHA optimization: Register commands with ioredis
// This enables automatic SHA caching and eliminates inline script transmission
export function registerRedisScripts(redis: Redis): void {
  // Register upsert command for EVALSHA optimization
  redis.defineCommand('upsertEntity', RedisAtomicScripts.upsert);

  // Register soft delete command for EVALSHA optimization
  redis.defineCommand('softDeleteEntity', RedisAtomicScripts.softDelete);
}

// ✅ TypeScript augmentation for ioredis custom commands
declare module 'ioredis' {
  interface RedisCommander {
    upsertEntity(
      entityKey: string,
      indexKey: string,
      entityId: string,
      version: string,
      updatedAtMs: string,
      ...fieldPairs: string[]
    ): Promise<number>; // 1 = applied, 0 = stale_occ

    softDeleteEntity(
      entityKey: string,
      indexKey: string,
      entityId: string,
      deletedAtIso: string,
      ttlSeconds: string,
    ): Promise<number>; // 1 = applied
  }
}

// ✅ Key validation helpers for cluster safety
export class RedisClusterUtils {
  /**
   * Validates that keys contain proper hash-tags for cluster locality
   * Both entityKey and indexKey must contain the same {tag} portion
   */
  static validateHashTagConsistency(entityKey: string, indexKey: string): void {
    const entityTag = this.extractHashTag(entityKey);
    const indexTag = this.extractHashTag(indexKey);

    if (!entityTag || !indexTag) {
      throw new Error(
        `Keys must contain hash-tags: entity="${entityKey}", index="${indexKey}"`,
      );
    }

    if (entityTag !== indexTag) {
      throw new Error(
        `Hash-tag mismatch: entity="{${entityTag}}", index="{${indexTag}}"`,
      );
    }
  }

  /**
   * Extracts hash-tag from Redis key (content between first { and })
   */
  private static extractHashTag(key: string): string | null {
    const match = key.match(/\{([^}]+)\}/);
    return match ? match[1] : null;
  }

  /**
   * Ensures key contains hash-tag for cluster routing
   */
  static ensureHashTag(key: string, tag: string): string {
    if (key.includes(`{${tag}}`)) {
      return key; // Already has correct hash-tag
    }

    // Insert hash-tag after first colon if present
    const colonIndex = key.indexOf(':');
    if (colonIndex !== -1) {
      const prefix = key.substring(0, colonIndex);
      const suffix = key.substring(colonIndex);
      return `${prefix}:{${tag}}${suffix}`;
    }

    // No colon, prepend hash-tag
    return `{${tag}}:${key}`;
  }
}
