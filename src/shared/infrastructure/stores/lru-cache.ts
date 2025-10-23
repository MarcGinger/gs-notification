/**
 * LRU Cache Implementation
 *
 * Generic Least Recently Used cache with bounded memory usage.
 * Perfect for in-memory projectors and caching scenarios.
 *
 * Features:
 * - Generic type support for any key-value pairs
 * - Configurable maximum size with automatic eviction
 * - O(1) get/set operations
 * - LRU eviction policy (removes least recently used items)
 * - Full Map-like interface
 * - Testing and inspection utilities
 * - Memory-efficient implementation
 *
 * Use Cases:
 * - Bounded caches for projections
 * - In-memory entity storage with eviction
 * - Testing scenarios requiring controlled memory usage
 * - Caching layers for high-performance operations
 * - Temporary storage with automatic cleanup
 */

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 10000) {
    if (maxSize <= 0) {
      throw new Error('LRU cache maxSize must be greater than 0');
    }
    this.maxSize = maxSize;
  }

  /**
   * Get value by key, promoting it to most recently used
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  /**
   * Set key-value pair, with automatic LRU eviction if needed
   * @returns true if eviction occurred, false otherwise
   */
  set(key: K, value: V): boolean {
    if (this.cache.has(key)) {
      // Update existing entry
      this.cache.delete(key);
      this.cache.set(key, value);
      return false; // No eviction
    }

    // Add new entry
    if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value as K;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
      this.cache.set(key, value);
      return true; // Eviction occurred
    }

    this.cache.set(key, value);
    return false; // No eviction
  }

  /**
   * Delete entry by key
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get maximum cache size
   */
  maxCapacity(): number {
    return this.maxSize;
  }

  /**
   * Check if cache is at maximum capacity
   */
  isFull(): boolean {
    return this.cache.size >= this.maxSize;
  }

  /**
   * Get cache utilization ratio (0-1)
   */
  utilization(): number {
    return this.cache.size / this.maxSize;
  }

  /**
   * Get all keys iterator
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * Get all values iterator
   */
  values(): IterableIterator<V> {
    return this.cache.values();
  }

  /**
   * Get all entries iterator
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  // Testing and inspection utilities

  /**
   * Convert cache to array (preserves LRU order)
   */
  toArray(): Array<[K, V]> {
    return Array.from(this.cache.entries());
  }

  /**
   * Get keys as array (preserves LRU order)
   */
  keysArray(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get values as array (preserves LRU order)
   */
  valuesArray(): V[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get least recently used key (first to be evicted)
   */
  getLRUKey(): K | undefined {
    return this.cache.keys().next().value as K | undefined;
  }

  /**
   * Get most recently used key (last to be evicted)
   */
  getMRUKey(): K | undefined {
    const keys = Array.from(this.cache.keys());
    return keys[keys.length - 1];
  }

  /**
   * Load cache from array (useful for initialization and testing)
   */
  fromArray(entries: Array<[K, V]>): void {
    this.cache.clear();
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /**
   * Get cache statistics for monitoring and debugging
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilization: number;
    isFull: boolean;
    lruKey?: K;
    mruKey?: K;
    memoryEstimateBytes: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: this.utilization(),
      isFull: this.isFull(),
      lruKey: this.getLRUKey(),
      mruKey: this.getMRUKey(),
      memoryEstimateBytes: this.cache.size * 512, // Rough estimate
    };
  }

  /**
   * Create a shallow copy of the cache
   */
  clone(): LRUCache<K, V> {
    const newCache = new LRUCache<K, V>(this.maxSize);
    newCache.fromArray(this.toArray());
    return newCache;
  }

  /**
   * Peek at value without promoting to MRU
   */
  peek(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Set multiple entries at once
   */
  setMany(entries: Array<[K, V]>): number {
    let evictionCount = 0;
    for (const [key, value] of entries) {
      if (this.set(key, value)) {
        evictionCount++;
      }
    }
    return evictionCount;
  }

  /**
   * Delete multiple entries at once
   */
  deleteMany(keys: K[]): number {
    let deletedCount = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }
}
