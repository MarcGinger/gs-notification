/**
 * In-Memory Checkpoint Store
 *
 * Reusable checkpoint storage implementation for in-memory projectors.
 * Perfect for testing, prototyping, and scenarios where persistence is not required.
 *
 * Features:
 * - Zero external dependencies
 * - Fast read/write operations
 * - Compare-and-set for concurrent writers
 * - Batch operations support
 * - Testing and inspection utilities
 * - Full CheckpointStore interface compliance
 *
 * Use Cases:
 * - Unit testing projectors without infrastructure
 * - Rapid prototyping and development
 * - Shadow mode validation
 * - Benchmarking and performance testing
 * - Ephemeral caches and temporary storage
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CheckpointStore,
  CheckpointPosition,
} from '../projections/checkpoint.store';

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, CheckpointPosition>();

  async get(key: string): Promise<CheckpointPosition | null> {
    return Promise.resolve(this.checkpoints.get(key) || null);
  }

  async set(
    key: string,
    position: CheckpointPosition,
    _ttlSeconds?: number,
  ): Promise<void> {
    // TTL is ignored in memory implementation but interface compatible
    this.checkpoints.set(key, position);
    return Promise.resolve();
  }

  async delete(key: string): Promise<void> {
    this.checkpoints.delete(key);
    return Promise.resolve();
  }

  async exists(key: string): Promise<boolean> {
    return Promise.resolve(this.checkpoints.has(key));
  }

  async scan(prefix?: string, _pageSize?: number): Promise<string[]> {
    const keys = Array.from(this.checkpoints.keys());
    return Promise.resolve(
      prefix ? keys.filter((key) => key.startsWith(prefix)) : keys,
    );
  }

  async getAll(
    prefix?: string,
    _pageSize?: number,
  ): Promise<Record<string, CheckpointPosition>> {
    const result: Record<string, CheckpointPosition> = {};

    for (const [key, value] of this.checkpoints.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        result[key] = value;
      }
    }

    return Promise.resolve(result);
  }

  async clear(prefix?: string, _pageSize?: number): Promise<number> {
    if (!prefix) {
      const count = this.checkpoints.size;
      this.checkpoints.clear();
      return Promise.resolve(count);
    }

    let deletedCount = 0;
    for (const key of this.checkpoints.keys()) {
      if (key.startsWith(prefix)) {
        this.checkpoints.delete(key);
        deletedCount++;
      }
    }

    return Promise.resolve(deletedCount);
  }

  async setIfNewer(
    key: string,
    position: CheckpointPosition,
    _ttlSeconds?: number,
  ): Promise<boolean> {
    const existing = this.checkpoints.get(key);

    if (!existing || BigInt(position.commit) >= BigInt(existing.commit)) {
      this.checkpoints.set(key, position);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  // Testing and inspection utilities

  /**
   * Get all checkpoints synchronously for testing
   */
  getAllSync(): Map<string, CheckpointPosition> {
    return new Map(this.checkpoints);
  }

  /**
   * Get checkpoint count
   */
  size(): number {
    return this.checkpoints.size;
  }

  /**
   * Get all checkpoint keys
   */
  keys(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Get all checkpoint values
   */
  values(): CheckpointPosition[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * Convert to array for testing and inspection
   */
  toArray(): Array<[string, CheckpointPosition]> {
    return Array.from(this.checkpoints.entries());
  }

  /**
   * Load from array (useful for testing and initialization)
   */
  fromArray(entries: Array<[string, CheckpointPosition]>): void {
    this.checkpoints.clear();
    for (const [key, value] of entries) {
      this.checkpoints.set(key, value);
    }
  }

  /**
   * Get statistics for monitoring and debugging
   */
  getStats(): {
    totalCheckpoints: number;
    keys: string[];
    memoryEstimateBytes: number;
  } {
    return {
      totalCheckpoints: this.checkpoints.size,
      keys: Array.from(this.checkpoints.keys()),
      memoryEstimateBytes: this.checkpoints.size * 256, // Rough estimate
    };
  }
}
