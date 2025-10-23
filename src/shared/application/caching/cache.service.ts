import { Injectable } from '@nestjs/common';
import { Log, Logger } from '../../logging';

export * from './cache.config';

/**
 * Cache service interface for repository implementations
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * In-memory cache implementation for development and testing
 * In production, this should be replaced with Redis or similar
 */
@Injectable()
export class InMemoryCacheService implements CacheService {
  // Injected pino-compatible logger isn't available here; create a local pino-like shim
  // using console for lightweight environments. In production, replace with APP_LOGGER injection.
  private readonly logger: Logger = console as unknown as Logger;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }

    Log.debug(this.logger, 'Cache hit', {
      service: 'shared',
      component: 'InMemoryCacheService',
      method: 'get',
      key,
    });
    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });
    Log.debug(this.logger, 'Cache set', {
      service: 'shared',
      component: 'InMemoryCacheService',
      method: 'set',
      key,
      ttlSeconds,
    });
    return Promise.resolve();
  }

  invalidate(key: string): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      Log.debug(this.logger, 'Cache invalidated', {
        service: 'shared',
        component: 'InMemoryCacheService',
        method: 'invalidate',
        key,
      });
    }
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.cache.clear();
    Log.info(this.logger, 'Cache cleared', {
      service: 'shared',
      component: 'InMemoryCacheService',
      method: 'clear',
    });
    return Promise.resolve();
  }

  exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return Promise.resolve(false);
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need hit/miss tracking
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Log.info(this.logger, 'Cleaned up expired cache entries', {
        service: 'shared',
        component: 'InMemoryCacheService',
        method: 'cleanupExpired',
        cleaned,
      });
    }
  }

  private estimateMemoryUsage(): number {
    // Simple estimation - in production use proper memory measurement
    return this.cache.size * 1024; // Rough estimate: 1KB per entry
  }
}

/**
 * Cache service factory that creates appropriate implementation based on configuration
 */
@Injectable()
export class CacheServiceFactory {
  private readonly logger: Logger = console as unknown as Logger;

  create(type: 'memory' | 'redis' = 'memory'): CacheService {
    switch (type) {
      case 'memory':
        Log.info(this.logger, 'Creating in-memory cache service', {
          service: 'shared',
          component: 'CacheServiceFactory',
          method: 'create',
          type,
        });
        return new InMemoryCacheService();
      case 'redis':
        // TODO: Implement Redis cache service
        Log.warn(
          this.logger,
          'Redis cache service not implemented, falling back to memory',
          {
            service: 'shared',
            component: 'CacheServiceFactory',
            method: 'create',
            requestedType: 'redis',
          },
        );
        return new InMemoryCacheService();
      default:
        Log.warn(
          this.logger,
          `Unknown cache type: ${String(type)}, falling back to memory`,
          {
            service: 'shared',
            component: 'CacheServiceFactory',
            method: 'create',
            requestedType: type,
          },
        );
        return new InMemoryCacheService();
    }
  }
}

interface CacheEntry {
  value: unknown;
  expiresAt: number | null;
  createdAt: number;
}

export interface CacheStats {
  size: number;
  hitRate: number;
  memoryUsage?: number;
}
