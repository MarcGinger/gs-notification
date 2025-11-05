import { Injectable } from '@nestjs/common';
import { CacheLayer } from './cache.layer';
import { ResolvedSecret, SecretRef } from '../secret-ref.types';
import { buildKey } from '../utils/key.util';

@Injectable()
export class InMemoryCache extends CacheLayer {
  private store = new Map<string, { v: ResolvedSecret; exp: number }>();
  private max = 2000; // basic LRU-ish cap

  buildKey(ref: SecretRef) {
    return buildKey(ref);
  }

  async get(key: string) {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.exp) {
      this.store.delete(key);
      return null;
    }
    return e.v;
  }

  async set(
    key: string,
    value: ResolvedSecret,
    opts: { ttlMs: number; jitterPct?: number },
  ) {
    const jitter = opts.jitterPct
      ? opts.ttlMs * (Math.random() * opts.jitterPct)
      : 0;
    const exp = Date.now() + Math.max(1000, opts.ttlMs - jitter);
    if (this.store.size >= this.max) {
      // naive eviction
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }
    this.store.set(key, { v: value, exp });
  }
}
