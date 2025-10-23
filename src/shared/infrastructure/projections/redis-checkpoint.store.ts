import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Log, componentLogger, Logger } from '../../logging';
import { CheckpointPosition, CheckpointStore } from './checkpoint.store';

const APP_LOGGER = 'APP_LOGGER';

const COMPONENT = 'RedisCheckpointStore';

/**
 * Production-ready Redis checkpoint store
 * Features:
 * - Full {commit, prepare} position storage (no precision loss)
 * - Hash-based storage for structured data
 * - SCAN instead of KEYS (non-blocking)
 * - UNLINK for efficient bulk deletion
 * - Structured Pino logging
 * - Optional TTL and environment namespacing
 * - Batched/pipelined operations
 * - Optional CAS for concurrent writers
 */
@Injectable()
export class RedisCheckpointStore implements CheckpointStore {
  private readonly prefix: string;
  private readonly casScript: string;

  constructor(
    private readonly redis: Redis,
    @Inject(APP_LOGGER) private readonly logger: Logger,
    // Pass env/service to avoid collisions, e.g. 'prod:', 'dev:', etc.
    envPrefix: string = '',
  ) {
    // create component-scoped child logger
    this.logger = componentLogger(this.logger, COMPONENT);
    this.prefix = `${envPrefix}checkpoint:`; // e.g. 'prod:checkpoint:'

    // Lua script for compare-and-set: only update if incoming commit >= stored commit
    this.casScript = `
      local key = KEYS[1]
      local newCommit = ARGV[1]
      local newPrepare = ARGV[2]
      local newUpdatedAt = ARGV[3]
      local ttl = tonumber(ARGV[4]) or 0
      
      local current = redis.call('HGET', key, 'commit')
      if not current or tonumber(newCommit) >= tonumber(current) then
        redis.call('HSET', key, 'commit', newCommit, 'prepare', newPrepare, 'updatedAt', newUpdatedAt)
        if ttl > 0 then
          redis.call('EXPIRE', key, ttl)
        end
        return 1
      else
        return 0
      end
    `;
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get checkpoint position with full commit/prepare details
   */
  async get(key: string): Promise<CheckpointPosition | null> {
    try {
      const obj = await this.redis.hgetall(this.k(key));

      if (!obj || Object.keys(obj).length === 0) {
        Log.debug(this.logger, 'Checkpoint not found', {
          method: 'get',
          key,
        });
        return null;
      }

      if (!obj.commit || !obj.prepare) {
        Log.warn(this.logger, 'Checkpoint missing required fields', {
          method: 'get',
          key,
          foundFields: Object.keys(obj).join(','),
        });
        return null;
      }

      const position: CheckpointPosition = {
        commit: obj.commit,
        prepare: obj.prepare,
        updatedAt: obj.updatedAt,
      };

      Log.debug(this.logger, 'Checkpoint retrieved', {
        method: 'get',
        key,
        commit: position.commit,
        prepare: position.prepare,
      });

      return position;
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to get checkpoint', {
        method: 'get',
        key,
        error: e.message,
        stack: e.stack,
      });
      return null;
    }
  }

  /**
   * Set checkpoint position with optional TTL
   */
  async set(
    key: string,
    pos: CheckpointPosition,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const payload: Record<string, string> = {
        commit: pos.commit,
        prepare: pos.prepare,
        updatedAt: pos.updatedAt ?? now,
      };

      const rkey = this.k(key);
      const multi = this.redis.multi().hset(rkey, payload);

      if (ttlSeconds && ttlSeconds > 0) {
        multi.expire(rkey, ttlSeconds);
      }

      await multi.exec();

      Log.debug(this.logger, 'Checkpoint set', {
        method: 'set',
        key,
        commit: pos.commit,
        prepare: pos.prepare,
        ttlSeconds: ttlSeconds ?? null,
      });
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to set checkpoint', {
        method: 'set',
        key,
        position: pos,
        error: e.message,
        stack: e.stack,
      });
      throw err;
    }
  }

  /**
   * Delete checkpoint using UNLINK (non-blocking)
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.unlink(this.k(key)); // Non-blocking delete

      Log.debug(this.logger, 'Checkpoint deleted', {
        method: 'delete',
        key,
      });
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to delete checkpoint', {
        method: 'delete',
        key,
        error: e.message,
        stack: e.stack,
      });
      throw err;
    }
  }

  /**
   * Check if checkpoint exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(this.k(key));
      return exists === 1;
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to check checkpoint existence', {
        method: 'exists',
        key,
        error: e.message,
        stack: e.stack,
      });
      return false;
    }
  }

  /**
   * SCAN for checkpoint keys (non-blocking, paginated)
   */
  async scan(prefix = '*', pageSize = 500): Promise<string[]> {
    const pattern = `${this.prefix}${prefix}`;
    let cursor = '0';
    const keys: string[] = [];

    try {
      do {
        const [nextCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          pageSize,
        );
        cursor = nextCursor;

        if (foundKeys.length > 0) {
          // Remove prefix to get clean keys
          keys.push(...foundKeys.map((k) => k.replace(this.prefix, '')));
        }
      } while (cursor !== '0');

      Log.debug(this.logger, 'Checkpoint keys scanned', {
        method: 'scan',
        prefix,
        count: keys.length,
        pageSize,
      });

      return keys;
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to scan checkpoint keys', {
        method: 'scan',
        prefix,
        pageSize,
        error: e.message,
        stack: e.stack,
      });
      return [];
    }
  }

  /**
   * Get all checkpoints with SCAN + pipelined HGETALL
   */
  async getAll(
    prefix = '*',
    pageSize = 500,
  ): Promise<Record<string, CheckpointPosition>> {
    const result: Record<string, CheckpointPosition> = {};
    const pattern = `${this.prefix}${prefix}`;
    let cursor = '0';

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          pageSize,
        );
        cursor = nextCursor;

        if (keys.length === 0) continue;

        // Pipeline HGETALL for all keys in this batch
        const pipeline = this.redis.pipeline();
        keys.forEach((k) => pipeline.hgetall(k));
        const replies = await pipeline.exec();

        // Process results
        keys.forEach((k, i) => {
          const cleanKey = k.replace(this.prefix, '');
          const obj = replies?.[i]?.[1] as Record<string, string> | null;

          if (obj && obj.commit && obj.prepare) {
            result[cleanKey] = {
              commit: obj.commit,
              prepare: obj.prepare,
              updatedAt: obj.updatedAt,
            };
          }
        });
      } while (cursor !== '0');

      Log.debug(this.logger, 'All checkpoints retrieved', {
        method: 'getAll',
        prefix,
        count: Object.keys(result).length,
        pageSize,
      });

      return result;
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to get all checkpoints', {
        method: 'getAll',
        prefix,
        pageSize,
        error: e.message,
        stack: e.stack,
      });
      return {};
    }
  }

  /**
   * Clear checkpoints with SCAN + chunked UNLINK
   */
  async clear(prefix = '*', pageSize = 500): Promise<number> {
    const pattern = `${this.prefix}${prefix}`;
    let cursor = '0';
    let totalDeleted = 0;

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          pageSize,
        );
        cursor = nextCursor;

        if (keys.length === 0) continue;

        // Chunk UNLINK operations to avoid large commands (Redis max ~256 args)
        const chunks: string[][] = [];
        for (let i = 0; i < keys.length; i += 256) {
          chunks.push(keys.slice(i, i + 256));
        }

        for (const chunk of chunks) {
          const deleted = await this.redis.unlink(...chunk);
          totalDeleted += deleted;
        }
      } while (cursor !== '0');

      Log.info(this.logger, 'Checkpoints cleared', {
        method: 'clear',
        prefix,
        deleted: totalDeleted,
        pageSize,
      });

      return totalDeleted;
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to clear checkpoints', {
        method: 'clear',
        prefix,
        pageSize,
        error: e.message,
        stack: e.stack,
      });
      throw err;
    }
  }

  /**
   * Compare-and-set: only update if incoming commit >= stored commit
   * Prevents regressions from concurrent writers with clock skew
   */
  async setIfNewer(
    key: string,
    pos: CheckpointPosition,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const updatedAt = pos.updatedAt ?? now;
      const ttl = ttlSeconds ?? 0;

      const result = (await this.redis.eval(
        this.casScript,
        1, // key count
        this.k(key),
        pos.commit,
        pos.prepare,
        updatedAt,
        ttl.toString(),
      )) as number;

      const updated = result === 1;

      Log.debug(this.logger, 'Compare-and-set checkpoint', {
        method: 'setIfNewer',
        key,
        commit: pos.commit,
        prepare: pos.prepare,
        updated,
        ttlSeconds: ttlSeconds ?? null,
      });

      return updated;
    } catch (err) {
      const e = err as Error;
      Log.error(this.logger, 'Failed to compare-and-set checkpoint', {
        method: 'setIfNewer',
        key,
        position: pos,
        error: e.message,
        stack: e.stack,
      });
      return false;
    }
  }
}
