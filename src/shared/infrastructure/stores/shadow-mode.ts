/**
 * Shadow Mode Infrastructure
 *
 * Reusable validation and comparison framework for projection systems.
 * Enables parallel execution of different projection implementations for validation,
 * canary testing, and migration scenarios.
 *
 * Features:
 * - Parallel execution with production/test projector pairs
 * - Deep object comparison with diff reporting
 * - Configurable comparison strategies
 * - Comprehensive validation metrics
 * - Error isolation and reporting
 * - Performance impact measurement
 * - Sampling and throttling support
 *
 * Use Cases:
 * - Migration validation (old vs new implementation)
 * - Canary testing new projection logic
 * - Performance comparison between architectures
 * - Contract evolution validation
 * - A/B testing projection strategies
 * - Quality assurance for refactoring
 */

import {
  ShadowModeMetrics,
  ShadowModeMetricsCollector,
} from './projection-metrics';

/**
 * Shadow mode configuration options
 */
export interface ShadowModeConfig {
  // Sampling configuration
  samplingRate?: number; // 0.0 to 1.0, percentage of events to compare
  maxComparisonsPerSecond?: number; // Rate limiting

  // Comparison configuration
  ignoreFields?: string[]; // Fields to ignore during comparison
  toleranceMs?: number; // Timestamp tolerance for time-based fields
  deepCompare?: boolean; // Enable deep object comparison

  // Error handling
  continueOnError?: boolean; // Continue shadow mode after comparison errors
  maxErrorCount?: number; // Stop shadow mode after this many errors

  // Performance monitoring
  maxLatencyMs?: number; // Warn if comparison takes longer than this
  enablePerformanceTracking?: boolean;
}

/**
 * Comparison result with detailed diff information
 */
export interface ComparisonResult<T = unknown> {
  isMatch: boolean;
  primaryResult: T;
  shadowResult: T;
  differences: ComparisonDifference[];
  comparisonLatencyMs: number;
  error?: string;
}

/**
 * Individual field difference
 */
export interface ComparisonDifference {
  path: string;
  primaryValue: unknown;
  shadowValue: unknown;
  type: 'missing' | 'extra' | 'different' | 'type-mismatch';
}

/**
 * Shadow mode callback function type
 */
export type ShadowModeCallback<T> = (
  key: string,
  primaryResult: T,
  shadowResult?: T,
  comparisonResult?: ComparisonResult,
) => void;

/**
 * Shadow mode validator for projection systems
 */
export class ShadowModeValidator<T = any> {
  private readonly config: Required<ShadowModeConfig>;
  private readonly metricsCollector: ShadowModeMetricsCollector;
  private lastComparisonTime = 0;
  private errorCount = 0;
  private enabled = false;

  constructor(config: ShadowModeConfig = {}) {
    this.config = {
      samplingRate: config.samplingRate ?? 1.0,
      maxComparisonsPerSecond: config.maxComparisonsPerSecond ?? 100,
      ignoreFields: config.ignoreFields ?? [],
      toleranceMs: config.toleranceMs ?? 1000,
      deepCompare: config.deepCompare ?? true,
      continueOnError: config.continueOnError ?? true,
      maxErrorCount: config.maxErrorCount ?? 100,
      maxLatencyMs: config.maxLatencyMs ?? 5000,
      enablePerformanceTracking: config.enablePerformanceTracking ?? true,
    };

    this.metricsCollector = new ShadowModeMetricsCollector();
  }

  /**
   * Enable shadow mode validation
   */
  enable(): void {
    this.enabled = true;
    this.errorCount = 0;
    this.metricsCollector.reset();
  }

  /**
   * Disable shadow mode validation
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if shadow mode is enabled and should run for this event
   */
  shouldCompare(): boolean {
    if (!this.enabled) return false;

    // Check error threshold
    if (this.errorCount >= this.config.maxErrorCount) {
      this.disable();
      return false;
    }

    // Check sampling rate
    if (Math.random() > this.config.samplingRate) {
      return false;
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastMs = now - this.lastComparisonTime;
    const minIntervalMs = 1000 / this.config.maxComparisonsPerSecond;

    if (timeSinceLastMs < minIntervalMs) {
      return false;
    }

    this.lastComparisonTime = now;
    return true;
  }

  /**
   * Compare primary and shadow results
   */
  compare(
    key: string,
    primaryResult: T,
    shadowResult: T,
    callback?: ShadowModeCallback<T>,
  ): ComparisonResult<T> {
    const startTime = performance.now();
    let result: ComparisonResult<T>;

    try {
      const differences = this.findDifferences(primaryResult, shadowResult);
      const isMatch = differences.length === 0;

      result = {
        isMatch,
        primaryResult,
        shadowResult,
        differences,
        comparisonLatencyMs: performance.now() - startTime,
      } as ComparisonResult<T>;

      // Record metrics
      this.metricsCollector.recordComparison(isMatch, differences.length);

      // Check performance threshold
      if (
        this.config.enablePerformanceTracking &&
        result.comparisonLatencyMs > this.config.maxLatencyMs
      ) {
        console.warn(
          `Shadow mode comparison took ${result.comparisonLatencyMs}ms for key: ${key}`,
        );
      }
    } catch (error) {
      const e = error as Error;
      this.errorCount++;
      this.metricsCollector.recordError();

      result = {
        isMatch: false,
        primaryResult,
        shadowResult,
        differences: [],
        comparisonLatencyMs: performance.now() - startTime,
        error: e.message,
      } as ComparisonResult<T>;

      if (!this.config.continueOnError) {
        this.disable();
      }
    }

    // Invoke callback if provided
    if (callback) {
      try {
        callback(key, primaryResult, shadowResult, result);
      } catch (callbackError) {
        console.error('Shadow mode callback error:', callbackError);
      }
    }

    return result;
  }

  /**
   * Get current shadow mode metrics
   */
  getMetrics(): ShadowModeMetrics {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Reset metrics and error counts
   */
  reset(): void {
    this.metricsCollector.reset();
    this.errorCount = 0;
    this.lastComparisonTime = 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ShadowModeConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration (merges with existing)
   */
  updateConfig(newConfig: Partial<ShadowModeConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Check if shadow mode is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // Private helper methods

  /**
   * Find differences between two objects
   */
  private findDifferences(
    primary: unknown,
    shadow: unknown,
    path = '',
  ): ComparisonDifference[] {
    const differences: ComparisonDifference[] = [];

    if (!this.config.deepCompare) {
      // Simple comparison
      if (!this.areEqual(primary, shadow)) {
        differences.push({
          path: path || 'root',
          primaryValue: primary,
          shadowValue: shadow,
          type: 'different',
        });
      }
      return differences;
    }

    // Deep comparison
    this.compareObjects(primary, shadow, path, differences);

    return differences;
  }

  /**
   * Recursively compare object properties
   */
  private compareObjects(
    primary: unknown,
    shadow: unknown,
    path: string,
    differences: ComparisonDifference[],
  ): void {
    // Handle null/undefined cases
    if (primary === null || primary === undefined) {
      if (shadow !== null && shadow !== undefined) {
        differences.push({
          path,
          primaryValue: primary,
          shadowValue: shadow,
          type: 'different',
        });
      }
      return;
    }

    if (shadow === null || shadow === undefined) {
      differences.push({
        path,
        primaryValue: primary,
        shadowValue: shadow,
        type: 'different',
      });
      return;
    }

    // Type comparison
    if (typeof primary !== typeof shadow) {
      differences.push({
        path,
        primaryValue: primary,
        shadowValue: shadow,
        type: 'type-mismatch',
      });
      return;
    }

    // Primitive comparison
    if (typeof primary !== 'object') {
      if (!this.areEqual(primary, shadow)) {
        differences.push({
          path,
          primaryValue: primary,
          shadowValue: shadow,
          type: 'different',
        });
      }
      return;
    }

    // Array comparison
    if (Array.isArray(primary)) {
      if (!Array.isArray(shadow)) {
        differences.push({
          path,
          primaryValue: primary,
          shadowValue: shadow,
          type: 'type-mismatch',
        });
        return;
      }

      const maxLength = Math.max(primary.length, shadow.length);
      for (let i = 0; i < maxLength; i++) {
        const currentPath = path ? `${path}[${i}]` : `[${i}]`;
        if (i >= primary.length) {
          differences.push({
            path: currentPath,
            primaryValue: undefined,
            shadowValue: shadow[i],
            type: 'extra',
          });
        } else if (i >= shadow.length) {
          differences.push({
            path: currentPath,
            primaryValue: primary[i],
            shadowValue: undefined,
            type: 'missing',
          });
        } else {
          this.compareObjects(primary[i], shadow[i], currentPath, differences);
        }
      }
      return;
    }

    // Object comparison - ensure we have objects
    if (!this.isRecord(primary) || !this.isRecord(shadow)) {
      differences.push({
        path,
        primaryValue: primary,
        shadowValue: shadow,
        type: 'type-mismatch',
      });
      return;
    }

    const primaryKeys = Object.keys(primary);
    const shadowKeys = Object.keys(shadow);
    const allKeys = new Set([...primaryKeys, ...shadowKeys]);

    for (const key of allKeys) {
      // Skip ignored fields
      if (this.config.ignoreFields.includes(key)) {
        continue;
      }

      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in primary)) {
        differences.push({
          path: currentPath,
          primaryValue: undefined,
          shadowValue: shadow[key],
          type: 'extra',
        });
      } else if (!(key in shadow)) {
        differences.push({
          path: currentPath,
          primaryValue: primary[key],
          shadowValue: undefined,
          type: 'missing',
        });
      } else {
        this.compareObjects(
          primary[key],
          shadow[key],
          currentPath,
          differences,
        );
      }
    }
  }

  /**
   * Type guard to check if value is a record (object with string keys)
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  /**
   * Check if two values are equal (with tolerance for dates)
   */
  private areEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    // Date comparison with tolerance
    if (a instanceof Date && b instanceof Date) {
      return Math.abs(a.getTime() - b.getTime()) <= this.config.toleranceMs;
    }

    return false;
  }
}

/**
 * Factory for creating shadow mode validators with common configurations
 */
export class ShadowModeFactory {
  /**
   * Create validator for migration scenarios
   */
  static forMigration<T>(
    config: Partial<ShadowModeConfig> = {},
  ): ShadowModeValidator<T> {
    return new ShadowModeValidator<T>({
      samplingRate: 0.1, // Sample 10% for migration validation
      maxComparisonsPerSecond: 10,
      deepCompare: true,
      continueOnError: true,
      maxErrorCount: 50,
      toleranceMs: 5000, // 5 second tolerance for timestamps
      ...config,
    });
  }

  /**
   * Create validator for canary testing
   */
  static forCanaryTesting<T>(
    config: Partial<ShadowModeConfig> = {},
  ): ShadowModeValidator<T> {
    return new ShadowModeValidator<T>({
      samplingRate: 0.01, // Sample 1% for canary testing
      maxComparisonsPerSecond: 5,
      deepCompare: true,
      continueOnError: true,
      maxErrorCount: 10,
      toleranceMs: 1000,
      ...config,
    });
  }

  /**
   * Create validator for performance testing
   */
  static forPerformanceTesting<T>(
    config: Partial<ShadowModeConfig> = {},
  ): ShadowModeValidator<T> {
    return new ShadowModeValidator<T>({
      samplingRate: 1.0, // Sample 100% for performance testing
      maxComparisonsPerSecond: 1000,
      deepCompare: false, // Shallow compare for performance
      continueOnError: true,
      maxErrorCount: 1000,
      enablePerformanceTracking: true,
      maxLatencyMs: 1000,
      ...config,
    });
  }

  /**
   * Create validator for development/testing
   */
  static forDevelopment<T>(
    config: Partial<ShadowModeConfig> = {},
  ): ShadowModeValidator<T> {
    return new ShadowModeValidator<T>({
      samplingRate: 1.0, // Sample 100% for development
      maxComparisonsPerSecond: 100,
      deepCompare: true,
      continueOnError: false, // Stop on first error in development
      maxErrorCount: 1,
      toleranceMs: 100,
      ...config,
    });
  }
}
