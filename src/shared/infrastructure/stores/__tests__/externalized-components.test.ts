/**
 * Tests for externalized store components
 *
 * These tests validate that the externalized components work correctly
 * and can be used as drop-in replacements for embedded implementations.
 */

import {
  InMemoryCheckpointStore,
  LRUCache,
  ProjectionMetricsCollector,
  ShadowModeValidator,
  ShadowModeFactory,
  createInMemoryProjectionStore,
} from '../index';

describe('Externalized Store Components', () => {
  describe('InMemoryCheckpointStore', () => {
    let store: InMemoryCheckpointStore;

    beforeEach(() => {
      store = new InMemoryCheckpointStore();
    });

    it('should store and retrieve checkpoints', async () => {
      const position = { commit: '123', prepare: '124' };

      await store.set('test-key', position);
      const retrieved = await store.get('test-key');

      expect(retrieved).toEqual(position);
    });

    it('should return null for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should support compare-and-set operations', async () => {
      const older = { commit: '100', prepare: '101' };
      const newer = { commit: '200', prepare: '201' };

      await store.set('test-key', older);

      // Should update with newer position
      const updated = await store.setIfNewer('test-key', newer);
      expect(updated).toBe(true);

      // Should not update with older position
      const notUpdated = await store.setIfNewer('test-key', older);
      expect(notUpdated).toBe(false);
    });

    it('should provide testing utilities', async () => {
      await store.set('key1', { commit: '100', prepare: '101' });
      await store.set('key2', { commit: '200', prepare: '201' });

      const stats = store.getStats();
      expect(stats.totalCheckpoints).toBe(2);
      expect(stats.keys).toEqual(['key1', 'key2']);

      const allSync = store.getAllSync();
      expect(allSync.size).toBe(2);
    });
  });

  describe('LRUCache', () => {
    let cache: LRUCache<string, string>;

    beforeEach(() => {
      cache = new LRUCache<string, string>(3); // Small size for testing
    });

    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should evict LRU items when full', () => {
      // Fill cache
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // This should evict key1 (least recently used)
      const evicted = cache.set('key4', 'value4');
      expect(evicted).toBe(true);

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key4')).toBe('value4');
    });

    it('should promote accessed items to MRU', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it MRU
      cache.get('key1');

      // Add new item - should evict key2 (now LRU)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1'); // Still there
      expect(cache.get('key2')).toBeUndefined(); // Evicted
    });

    it('should provide statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.utilization).toBeCloseTo(2 / 3);
      expect(stats.isFull).toBe(false);
    });
  });

  describe('ProjectionMetricsCollector', () => {
    let metrics: ProjectionMetricsCollector;

    beforeEach(() => {
      metrics = new ProjectionMetricsCollector();
    });

    it('should record events and calculate metrics', () => {
      metrics.recordEvent(100);
      metrics.recordEvent(200);
      metrics.recordCacheHit();
      metrics.recordCacheMiss();

      const currentMetrics = metrics.getMetrics();
      expect(currentMetrics.totalEvents).toBe(2);
      expect(currentMetrics.hitCount).toBe(1);
      expect(currentMetrics.missCount).toBe(1);
      expect(currentMetrics.projectionLatencyMs).toBe(200); // Last recorded
    });

    it('should calculate extended metrics', () => {
      // Record some sample data
      for (let i = 0; i < 10; i++) {
        metrics.recordEvent(i * 10); // 0, 10, 20, ..., 90
      }
      metrics.recordCacheHit();
      metrics.recordCacheHit();
      metrics.recordCacheMiss();

      const extended = metrics.getExtendedMetrics();
      expect(extended.totalEvents).toBe(10);
      expect(extended.hitRate).toBeCloseTo(2 / 3);
      expect(extended.missRate).toBeCloseTo(1 / 3);
      expect(extended.latencyP50Ms).toBeDefined();
      expect(extended.isHealthy).toBe(true); // No errors recorded
    });

    it('should export and import metrics', () => {
      metrics.recordEvent(100);
      metrics.recordError();

      const exported = metrics.exportMetrics();
      const newMetrics = new ProjectionMetricsCollector();
      newMetrics.importMetrics(exported);

      const imported = newMetrics.getMetrics();
      expect(imported.totalEvents).toBe(1);
      expect(imported.errorCount).toBe(1);
    });
  });

  describe('ShadowModeValidator', () => {
    let validator: ShadowModeValidator<{ id: string; value: number }>;

    beforeEach(() => {
      validator = ShadowModeFactory.forDevelopment<{
        id: string;
        value: number;
      }>();
      validator.enable();
    });

    it('should detect matching results', () => {
      const primary = { id: 'test', value: 42 };
      const shadow = { id: 'test', value: 42 };

      const result = validator.compare('key1', primary, shadow);

      expect(result.isMatch).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect differences', () => {
      const primary = { id: 'test', value: 42 };
      const shadow = { id: 'test', value: 43 };

      const result = validator.compare('key1', primary, shadow);

      expect(result.isMatch).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].path).toBe('value');
      expect(result.differences[0].primaryValue).toBe(42);
      expect(result.differences[0].shadowValue).toBe(43);
    });

    it('should respect sampling rate', () => {
      const validator = new ShadowModeValidator({ samplingRate: 0.0 });
      validator.enable();

      expect(validator.shouldCompare()).toBe(false);
    });

    it('should track metrics', () => {
      const primary = { id: 'test', value: 42 };
      const shadow1 = { id: 'test', value: 42 }; // Match
      const shadow2 = { id: 'test', value: 43 }; // Mismatch

      validator.compare('key1', primary, shadow1);
      validator.compare('key2', primary, shadow2);

      const metrics = validator.getMetrics();
      expect(metrics.comparisons).toBe(2);
      expect(metrics.matches).toBe(1);
      expect(metrics.mismatches).toBe(1);
      expect(metrics.matchRate).toBe(0.5);
    });
  });

  describe('createInMemoryProjectionStore factory', () => {
    it('should create store with all components', () => {
      const store = createInMemoryProjectionStore<{ id: string }>({
        maxCacheSize: 1000,
        enableMetrics: true,
        enableShadowMode: true,
      });

      expect(store.cache).toBeInstanceOf(LRUCache);
      expect(store.checkpointStore).toBeInstanceOf(InMemoryCheckpointStore);
      expect(store.metricsCollector).toBeInstanceOf(ProjectionMetricsCollector);
      expect(store.shadowValidator).toBeInstanceOf(ShadowModeValidator);
    });

    it('should provide convenience methods', async () => {
      const store = createInMemoryProjectionStore<{ id: string }>();

      // Test stats
      const stats = store.getStats();
      expect(stats.entityCount).toBe(0);

      // Test reset
      await store.reset();
      expect(store.cache.size()).toBe(0);

      // Test shadow mode controls
      store.enableShadowMode();
      expect(store.shadowValidator?.isEnabled()).toBe(true);

      store.disableShadowMode();
      expect(store.shadowValidator?.isEnabled()).toBe(false);
    });

    it('should work with minimal configuration', () => {
      const store = createInMemoryProjectionStore();

      expect(store.cache).toBeDefined();
      expect(store.checkpointStore).toBeDefined();
      expect(store.metricsCollector).toBeDefined();
      expect(store.shadowValidator).toBeUndefined(); // Disabled by default
    });
  });

  describe('Integration test', () => {
    it('should work together as a complete projection store', async () => {
      const store = createInMemoryProjectionStore<{ id: string; name: string }>(
        {
          maxCacheSize: 100,
          enableMetrics: true,
          enableShadowMode: false,
        },
      );

      // Store some projections
      store.cache.set('proj1', { id: 'proj1', name: 'Test Projection 1' });
      store.cache.set('proj2', { id: 'proj2', name: 'Test Projection 2' });

      // Store checkpoints
      await store.checkpointStore.set('checkpoint1', {
        commit: '100',
        prepare: '101',
      });

      // Record metrics
      store.metricsCollector?.recordEvent(50);
      store.metricsCollector?.recordCacheHit();
      store.metricsCollector?.updateEntityCount(store.cache.size());

      // Verify everything works together
      expect(store.cache.get('proj1')).toEqual({
        id: 'proj1',
        name: 'Test Projection 1',
      });

      const checkpoint = await store.checkpointStore.get('checkpoint1');
      expect(checkpoint?.commit).toBe('100');

      const metrics = store.metricsCollector?.getMetrics();
      expect(metrics?.totalEvents).toBe(1);
      expect(metrics?.entityCount).toBe(2);

      const stats = store.getStats();
      expect(stats.entityCount).toBe(2);
    });
  });
});
