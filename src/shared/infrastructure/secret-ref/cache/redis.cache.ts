import { Injectable, Optional } from '@nestjs/common';
import { CacheLayer } from './cache.layer';
import { ResolvedSecret, SecretRef } from '../secret-ref.types';
import { buildKey } from '../utils/key.util';
import type Redis from 'ioredis';

@Injectable()
export class RedisCache extends CacheLayer {
  constructor(@Optional() private readonly redis?: Redis) {
    super();
  }

  buildKey(ref: SecretRef) {
    return buildKey(ref);
  }

  async get(key: string) {
    try {
      if (!this.redis || this.redis.status !== 'ready') return null;
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as ResolvedSecret) : null;
    } catch (error) {
      // Log error and fallback to cache miss
      console.warn('Redis cache get failed, falling back to miss:', error);
      return null;
    }
  }

  async set(
    key: string,
    value: ResolvedSecret,
    opts: { ttlMs: number; jitterPct?: number },
  ) {
    try {
      if (!this.redis || this.redis.status !== 'ready') return;
      const jitter = opts.jitterPct
        ? opts.ttlMs * (Math.random() * opts.jitterPct)
        : 0;
      const ttl = Math.floor(Math.max(1000, opts.ttlMs - jitter) / 1000);
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      // Log error but don't throw - cache set failures shouldn't break the flow
      console.warn('Redis cache set failed:', error);
    }
  }
}
