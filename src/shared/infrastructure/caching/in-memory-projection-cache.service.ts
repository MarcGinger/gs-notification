import { Injectable } from '@nestjs/common';
import {
  ProjectionCacheService,
  ProjectionCacheStats,
} from './projection-cache.service';

/**
 * In-Memory implementation of ProjectionCacheService
 * Suitable for development and single-instance deployments
 */
@Injectable()
export class InMemoryProjectionCache implements ProjectionCacheService {
  private operationCache = new Map<
    string,
    { timestamp: number; ttl: number }
  >();
  private versionCache = new Map<
    string,
    { version: number; timestamp: number; ttl: number }
  >();
  private metadataCache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();

  private stats = {
    hits: 0,
    misses: 0,
    operations: 0,
  };

  async isOperationProcessed(operationId: string): Promise<boolean> {
    this.cleanup();
    const entry = this.operationCache.get(operationId);

    if (entry && Date.now() - entry.timestamp < entry.ttl * 1000) {
      this.stats.hits++;
      return true;
    }

    this.stats.misses++;
    return false;
  }

  async markOperationProcessed(
    operationId: string,
    ttlSeconds = 300,
  ): Promise<void> {
    this.operationCache.set(operationId, {
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });
    this.stats.operations++;
  }

  async getVersionHint(entityKey: string): Promise<number | null> {
    this.cleanup();
    const entry = this.versionCache.get(entityKey);

    if (entry && Date.now() - entry.timestamp < entry.ttl * 1000) {
      this.stats.hits++;
      return entry.version;
    }

    this.stats.misses++;
    return null;
  }

  async setVersionHint(
    entityKey: string,
    version: number,
    ttlSeconds = 300,
  ): Promise<void> {
    this.versionCache.set(entityKey, {
      version,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    this.cleanup();
    const entry = this.metadataCache.get(key);

    if (entry && Date.now() - entry.timestamp < entry.ttl * 1000) {
      this.stats.hits++;
      return entry.data;
    }

    this.stats.misses++;
    return null;
  }

  async setMetadata<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    this.metadataCache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });
  }

  async clearPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    // Clear matching entries from all caches
    for (const key of this.operationCache.keys()) {
      if (regex.test(key)) {
        this.operationCache.delete(key);
      }
    }

    for (const key of this.versionCache.keys()) {
      if (regex.test(key)) {
        this.versionCache.delete(key);
      }
    }

    for (const key of this.metadataCache.keys()) {
      if (regex.test(key)) {
        this.metadataCache.delete(key);
      }
    }
  }

  async getStats(): Promise<ProjectionCacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      size:
        this.operationCache.size +
        this.versionCache.size +
        this.metadataCache.size,
      operationCacheSize: this.operationCache.size,
      versionCacheSize: this.versionCache.size,
      metadataCacheSize: this.metadataCache.size,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  private cleanup(): void {
    const now = Date.now();

    // Cleanup operation cache
    for (const [key, entry] of this.operationCache.entries()) {
      if (now - entry.timestamp >= entry.ttl * 1000) {
        this.operationCache.delete(key);
      }
    }

    // Cleanup version cache
    for (const [key, entry] of this.versionCache.entries()) {
      if (now - entry.timestamp >= entry.ttl * 1000) {
        this.versionCache.delete(key);
      }
    }

    // Cleanup metadata cache
    for (const [key, entry] of this.metadataCache.entries()) {
      if (now - entry.timestamp >= entry.ttl * 1000) {
        this.metadataCache.delete(key);
      }
    }
  }

  private calculateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let usage = 0;

    for (const [key, value] of this.operationCache.entries()) {
      usage += key.length * 2 + JSON.stringify(value).length * 2;
    }

    for (const [key, value] of this.versionCache.entries()) {
      usage += key.length * 2 + JSON.stringify(value).length * 2;
    }

    for (const [key, value] of this.metadataCache.entries()) {
      usage += key.length * 2 + JSON.stringify(value).length * 2;
    }

    return usage;
  }
}
