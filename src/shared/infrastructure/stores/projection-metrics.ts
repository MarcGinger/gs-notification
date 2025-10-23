/**
 * Projection Metrics Collection
 *
 * Reusable metrics and observability components for projection systems.
 * Provides comprehensive monitoring capabilities for in-memory and persistent projectors.
 *
 * Features:
 * - Performance metrics (latency, throughput, error rates)
 * - Cache metrics (hits, misses, evictions)
 * - Memory usage tracking
 * - Event processing statistics
 * - Health and availability monitoring
 * - Time-based calculations
 * - Extensible metric types
 *
 * Use Cases:
 * - Monitoring projection performance
 * - Benchmarking different architectures
 * - Shadow mode validation metrics
 * - Production observability
 * - Testing and debugging insights
 */

/**
 * Core projection metrics interface
 */
export interface ProjectionMetrics {
  // Event processing metrics
  totalEvents: number;
  eventsPerSecond: number;
  projectionLatencyMs: number;
  errorCount: number;

  // Memory and cache metrics
  memoryUsageBytes: number;
  entityCount: number;
  evictionCount: number;
  hitCount: number;
  missCount: number;

  // Timing information
  startTime: Date;
  lastEventTime?: Date;
}

/**
 * Extended metrics with additional observability data
 */
export interface ExtendedProjectionMetrics extends ProjectionMetrics {
  // Performance percentiles
  latencyP50Ms?: number;
  latencyP95Ms?: number;
  latencyP99Ms?: number;

  // Throughput metrics
  peakEventsPerSecond: number;
  avgEventsPerSecond: number;

  // Error analysis
  errorRate: number;
  lastErrorTime?: Date;
  lastErrorMessage?: string;

  // Cache performance
  hitRate: number;
  missRate: number;
  evictionRate: number;

  // Resource utilization
  cpuUtilization?: number;
  memoryUtilization?: number;

  // Health indicators
  isHealthy: boolean;
  uptime: number;
  lastHealthCheck: Date;
}

/**
 * Metrics collector for projection systems
 */
export class ProjectionMetricsCollector {
  private metrics: ProjectionMetrics;
  private latencyHistory: number[] = [];
  private readonly maxLatencyHistory = 1000;

  constructor(startTime: Date = new Date()) {
    this.metrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      projectionLatencyMs: 0,
      memoryUsageBytes: 0,
      entityCount: 0,
      evictionCount: 0,
      hitCount: 0,
      missCount: 0,
      errorCount: 0,
      startTime,
    };
  }

  recordEvent(latencyMs: number): void {
    this.metrics.totalEvents++;
    this.metrics.projectionLatencyMs = latencyMs;
    this.metrics.lastEventTime = new Date();

    this.latencyHistory.push(latencyMs);
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }

    this.updateThroughput();
  }

  recordCacheHit(): void {
    this.metrics.hitCount++;
  }

  recordCacheMiss(): void {
    this.metrics.missCount++;
  }

  recordEviction(): void {
    this.metrics.evictionCount++;
  }

  recordError(): void {
    this.metrics.errorCount++;
  }

  updateEntityCount(count: number): void {
    this.metrics.entityCount = count;
  }

  updateMemoryUsage(bytes: number): void {
    this.metrics.memoryUsageBytes = bytes;
  }

  getMetrics(): ProjectionMetrics {
    this.updateThroughput();
    return { ...this.metrics };
  }

  getExtendedMetrics(): ExtendedProjectionMetrics {
    this.updateThroughput();

    const totalCacheOperations = this.metrics.hitCount + this.metrics.missCount;
    const hitRate =
      totalCacheOperations > 0
        ? this.metrics.hitCount / totalCacheOperations
        : 0;
    const missRate =
      totalCacheOperations > 0
        ? this.metrics.missCount / totalCacheOperations
        : 0;
    const evictionRate =
      this.metrics.entityCount > 0
        ? this.metrics.evictionCount / this.metrics.entityCount
        : 0;
    const errorRate =
      this.metrics.totalEvents > 0
        ? this.metrics.errorCount / this.metrics.totalEvents
        : 0;

    const uptime = new Date().getTime() - this.metrics.startTime.getTime();
    const avgEventsPerSecond =
      this.metrics.totalEvents / Math.max(uptime / 1000, 1);

    return {
      ...this.metrics,
      latencyP50Ms: this.calculatePercentile(50),
      latencyP95Ms: this.calculatePercentile(95),
      latencyP99Ms: this.calculatePercentile(99),
      peakEventsPerSecond: this.metrics.eventsPerSecond,
      avgEventsPerSecond,
      errorRate,
      hitRate,
      missRate,
      evictionRate,
      isHealthy: this.determineHealth(),
      uptime,
      lastHealthCheck: new Date(),
    };
  }

  reset(startTime: Date = new Date()): void {
    this.metrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      projectionLatencyMs: 0,
      memoryUsageBytes: 0,
      entityCount: 0,
      evictionCount: 0,
      hitCount: 0,
      missCount: 0,
      errorCount: 0,
      startTime,
    };
    this.latencyHistory = [];
  }

  exportMetrics(): string {
    return JSON.stringify(this.getExtendedMetrics(), null, 2);
  }

  importMetrics(json: string): void {
    const imported = JSON.parse(json) as ProjectionMetrics;
    this.metrics = {
      ...imported,
      startTime: new Date(imported.startTime),
      lastEventTime: imported.lastEventTime
        ? new Date(imported.lastEventTime)
        : undefined,
    };
  }

  getSummary(): {
    totalEvents: number;
    uptime: string;
    avgLatency: number;
    errorRate: number;
    hitRate: number;
    memoryUsageMB: number;
  } {
    const extended = this.getExtendedMetrics();
    const uptimeMs = extended.uptime;
    const uptimeStr = this.formatDuration(uptimeMs);

    return {
      totalEvents: extended.totalEvents,
      uptime: uptimeStr,
      avgLatency: extended.latencyP50Ms || 0,
      errorRate: extended.errorRate,
      hitRate: extended.hitRate,
      memoryUsageMB:
        Math.round((extended.memoryUsageBytes / (1024 * 1024)) * 100) / 100,
    };
  }

  private updateThroughput(): void {
    if (this.metrics.lastEventTime) {
      const elapsedSeconds =
        (this.metrics.lastEventTime.getTime() -
          this.metrics.startTime.getTime()) /
        1000;
      this.metrics.eventsPerSecond =
        this.metrics.totalEvents / Math.max(elapsedSeconds, 1);
    }
  }

  private calculatePercentile(percentile: number): number | undefined {
    if (this.latencyHistory.length === 0) return undefined;

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private determineHealth(): boolean {
    const errorRate =
      this.metrics.totalEvents > 0
        ? this.metrics.errorCount / this.metrics.totalEvents
        : 0;
    return errorRate < 0.05;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Shadow mode metrics for validation scenarios
 */
export interface ShadowModeMetrics {
  comparisons: number;
  matches: number;
  mismatches: number;
  errors: number;
  matchRate: number;
  lastComparisonTime?: Date;
  totalDifferences: number;
  avgDifferenceSize: number;
}

/**
 * Shadow mode metrics collector
 */
export class ShadowModeMetricsCollector {
  private metrics: ShadowModeMetrics = {
    comparisons: 0,
    matches: 0,
    mismatches: 0,
    errors: 0,
    matchRate: 0,
    totalDifferences: 0,
    avgDifferenceSize: 0,
  };

  recordComparison(isMatch: boolean, differenceSize = 0): void {
    this.metrics.comparisons++;
    this.metrics.lastComparisonTime = new Date();

    if (isMatch) {
      this.metrics.matches++;
    } else {
      this.metrics.mismatches++;
      this.metrics.totalDifferences += differenceSize;
    }

    this.updateMatchRate();
    this.updateAverageDifferenceSize();
  }

  recordError(): void {
    this.metrics.errors++;
  }

  getMetrics(): ShadowModeMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      comparisons: 0,
      matches: 0,
      mismatches: 0,
      errors: 0,
      matchRate: 0,
      totalDifferences: 0,
      avgDifferenceSize: 0,
    };
  }

  private updateMatchRate(): void {
    this.metrics.matchRate =
      this.metrics.comparisons > 0
        ? this.metrics.matches / this.metrics.comparisons
        : 0;
  }

  private updateAverageDifferenceSize(): void {
    this.metrics.avgDifferenceSize =
      this.metrics.mismatches > 0
        ? this.metrics.totalDifferences / this.metrics.mismatches
        : 0;
  }
}
