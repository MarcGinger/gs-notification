import { Injectable, Inject } from '@nestjs/common';
import { APP_LOGGER, Log, Logger } from '../../logging'; // ✅ Use barrel export
import { RepositoryMetrics } from '../../infrastructure/repositories/repository.types';

/**
 * Metrics collection service for repository operations
 * In production, this should integrate with Prometheus, DataDog, or similar
 */
@Injectable()
export class RepositoryMetricsService implements RepositoryMetrics {
  constructor(@Inject(APP_LOGGER) private readonly logger: Logger) {}
  private readonly metrics = new Map<string, MetricData>();

  recordSaveOperation(
    duration: number,
    success: boolean,
    entityType: string,
  ): void {
    const key = `save.${entityType}`;
    this.recordOperation(key, duration, success);
    Log.debug(
      this.logger,
      `Save operation for ${entityType}: ${duration}ms, success: ${success}`,
      {
        service: 'shared',
        component: 'RepositoryMetricsService',
        method: 'recordSaveOperation',
        entityType,
        duration,
        success,
      },
    );
  }

  recordQueryOperation(
    type: string,
    duration: number,
    cacheHit: boolean,
  ): void {
    const key = `query.${type}`;
    this.recordOperation(key, duration, true);

    // Track cache metrics separately
    const cacheKey = `cache.${type}`;
    this.recordCacheHit(cacheKey, cacheHit);

    Log.debug(
      this.logger,
      `Query operation ${type}: ${duration}ms, cache hit: ${cacheHit}`,
      {
        service: 'shared',
        component: 'RepositoryMetricsService',
        method: 'recordQueryOperation',
        type,
        duration,
        cacheHit,
      },
    );
  }

  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    key: string,
  ): void {
    const metricKey = `cache.${operation}`;
    const metric = this.getOrCreateMetric(metricKey);
    metric.count++;
    metric.lastUpdate = Date.now();

    Log.debug(this.logger, `Cache ${operation} for key: ${key}`, {
      service: 'shared',
      component: 'RepositoryMetricsService',
      method: 'recordCacheOperation',
      operation,
      key,
    });
  }

  /**
   * Get aggregated metrics for monitoring dashboards
   */
  getMetrics(): OperationMetrics[] {
    const results: OperationMetrics[] = [];

    for (const [key, data] of this.metrics.entries()) {
      results.push({
        operation: key,
        count: data.count,
        avgDuration: data.totalDuration / data.count,
        minDuration: data.minDuration,
        maxDuration: data.maxDuration,
        successRate: data.successCount / data.count,
        errorRate: (data.count - data.successCount) / data.count,
        lastUpdate: new Date(data.lastUpdate).toISOString(),
      });
    }

    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Get specific metrics for an operation
   */
  getOperationMetrics(operation: string): OperationMetrics | null {
    const data = this.metrics.get(operation);
    if (!data) {
      return null;
    }

    return {
      operation,
      count: data.count,
      avgDuration: data.totalDuration / data.count,
      minDuration: data.minDuration,
      maxDuration: data.maxDuration,
      successRate: data.successCount / data.count,
      errorRate: (data.count - data.successCount) / data.count,
      lastUpdate: new Date(data.lastUpdate).toISOString(),
    };
  }

  /**
   * Reset all metrics (useful for testing or periodic resets)
   */
  reset(): void {
    this.metrics.clear();
    Log.info(this.logger, 'Metrics reset', {
      service: 'shared',
      component: 'RepositoryMetricsService',
      method: 'reset',
    });
  }

  /**
   * Get health summary of repository operations
   */
  getHealthSummary(): HealthSummary {
    const allMetrics = this.getMetrics();

    if (allMetrics.length === 0) {
      return {
        status: 'unknown',
        totalOperations: 0,
        averageSuccessRate: 0,
        averageResponseTime: 0,
        recentErrors: 0,
      };
    }

    const totalOps = allMetrics.reduce((sum, m) => sum + m.count, 0);
    const avgSuccessRate =
      allMetrics.reduce((sum, m) => sum + m.successRate * m.count, 0) /
      totalOps;
    const avgResponseTime =
      allMetrics.reduce((sum, m) => sum + m.avgDuration * m.count, 0) /
      totalOps;

    // Simple health determination
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (avgSuccessRate < 0.95) status = 'degraded';
    if (avgSuccessRate < 0.9) status = 'unhealthy';
    if (avgResponseTime > 5000) status = 'degraded';
    if (avgResponseTime > 10000) status = 'unhealthy';

    return {
      status,
      totalOperations: totalOps,
      averageSuccessRate: avgSuccessRate,
      averageResponseTime: avgResponseTime,
      recentErrors: allMetrics.reduce(
        (sum, m) => sum + m.count * m.errorRate,
        0,
      ),
    };
  }

  private recordOperation(
    key: string,
    duration: number,
    success: boolean,
  ): void {
    const metric = this.getOrCreateMetric(key);

    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.lastUpdate = Date.now();

    if (success) {
      metric.successCount++;
    }
  }

  private recordCacheHit(key: string, hit: boolean): void {
    const metric = this.getOrCreateMetric(key);
    metric.count++;
    metric.lastUpdate = Date.now();

    if (hit) {
      metric.successCount++; // Use successCount to track hits
    }
  }

  private getOrCreateMetric(key: string): MetricData {
    let metric = this.metrics.get(key);
    if (!metric) {
      metric = {
        count: 0,
        totalDuration: 0,
        minDuration: Number.MAX_SAFE_INTEGER,
        maxDuration: 0,
        successCount: 0,
        lastUpdate: Date.now(),
      };
      this.metrics.set(key, metric);
    }
    return metric;
  }
}

interface MetricData {
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  successCount: number;
  lastUpdate: number;
}

export interface OperationMetrics {
  operation: string;
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  errorRate: number;
  lastUpdate: string;
}

export interface HealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  totalOperations: number;
  averageSuccessRate: number;
  averageResponseTime: number;
  recentErrors: number;
}
