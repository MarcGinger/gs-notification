import { z } from 'zod';
import { Result, ok, err, DomainError } from '../../errors';

/**
 * Duration Value Object
 * Represents a time duration with validation and rich operations
 */

export interface DurationVORefinements {
  minDuration?: {
    test: (ms: number) => boolean;
    error: () => DomainError;
  };
  maxDuration?: {
    test: (ms: number) => boolean;
    error: () => DomainError;
  };
  custom?: {
    test: (ms: number) => boolean;
    error: () => DomainError;
  };
}

export interface DurationVOErrors {
  invalid: () => DomainError;
  negative: () => DomainError;
  tooPrecise: () => DomainError;
  required: () => DomainError;
  custom: (value: number, reason: string) => DomainError;
}

export interface DurationVOInstance {
  readonly _value: number; // milliseconds
  toMilliseconds(): number;
  toSeconds(): number;
  toMinutes(): number;
  toHours(): number;
  toDays(): number;
  toHumanReadable(): string;
  add(other: DurationVOInstance): DurationVOInstance;
  subtract(other: DurationVOInstance): DurationVOInstance;
  multiply(factor: number): DurationVOInstance;
  divide(factor: number): DurationVOInstance;
  isLongerThan(other: DurationVOInstance): boolean;
  isShorterThan(other: DurationVOInstance): boolean;
  equals(other: DurationVOInstance): boolean;
  compare(other: DurationVOInstance): -1 | 0 | 1;
  toString(): string;
  toJSON(): { type: 'duration'; value: number; unit: 'ms' };
}

export interface DurationVOConfig {
  name: string;
  errors: DurationVOErrors;
  refinements?: DurationVORefinements;
  /** Whether the value is required */
  required?: boolean;
  /** Whether negative durations are allowed */
  nonNegative?: boolean;
  /** Minimum duration in milliseconds */
  minMs?: number;
  /** Maximum duration in milliseconds */
  maxMs?: number;
  /** Allow ISO 8601 duration format (PT1H30M) */
  allowIso8601?: boolean;
  /** Allow clock format (HH:MM:SS) */
  allowClock?: boolean;
  /** Allow milliseconds format */
  allowMillis?: boolean;
  /** Allow days unit (d) */
  allowDays?: boolean;
  /** Allow hours unit (h) */
  allowHours?: boolean;
  /** Allow minutes unit (m) */
  allowMinutes?: boolean;
  /** Allow seconds unit (s) */
  allowSeconds?: boolean;
  /** Allow milliseconds unit (ms) */
  allowMillisUnit?: boolean;
  /** Normalize to specific unit */
  normalizeTo?: string;
}

// Helper function to parse human-readable duration strings
export function parseDuration(
  input: string | number,
  config?: DurationVOConfig,
): number {
  if (typeof input === 'number') {
    return input;
  }

  const str = input.trim();

  // If it's just a number, treat as milliseconds
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Parse ISO 8601 duration format (PT1H30M5S)
  if (config?.allowIso8601 && str.startsWith('P')) {
    const match = str.match(
      /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
    );
    if (match) {
      const days = parseInt(match[1] || '0', 10);
      const hours = parseInt(match[2] || '0', 10);
      const minutes = parseInt(match[3] || '0', 10);
      const seconds = parseFloat(match[4] || '0');

      return (
        (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1000
      );
    }
  }

  // Parse clock format (HH:MM:SS or MM:SS)
  if (config?.allowClock) {
    const clockMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (clockMatch) {
      const hours = parseInt(clockMatch[1], 10);
      const minutes = parseInt(clockMatch[2], 10);
      const seconds = parseInt(clockMatch[3] || '0', 10);

      return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
    }
  }

  // Parse human-readable formats: 1d, 2h, 30m, 45s (including negative values)
  const match = str.match(/^(-?\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (!match) {
    throw new Error('Invalid duration format');
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  // Check if the unit is allowed
  if (config) {
    if (unit === 'ms' && config.allowMillisUnit === false) {
      throw new Error('Milliseconds unit not allowed');
    }
    if (unit === 's' && config.allowSeconds === false) {
      throw new Error('Seconds unit not allowed');
    }
    if (unit === 'm' && config.allowMinutes === false) {
      throw new Error('Minutes unit not allowed');
    }
    if (unit === 'h' && config.allowHours === false) {
      throw new Error('Hours unit not allowed');
    }
    if (unit === 'd' && config.allowDays === false) {
      throw new Error('Days unit not allowed');
    }
  }

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error('Unknown time unit');
  }
}

/**
 * Creates standardized error factory functions for duration value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., TaskErrors.INVALID_DURATION)
 * @param entityName - Human-readable name for the entity (e.g., 'Task Duration', 'Timeout')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createDurationVOErrors } from 'src/shared/domain/value-objects/duration-vo';
 * import { TaskErrors } from '../errors/task.errors';
 *
 * export const TaskDuration = createDurationVO({
 *   name: 'TaskDuration',
 *   errors: createDurationVOErrors(TaskErrors.INVALID_DURATION, 'Task Duration'),
 * });
 * ```
 */
export function createDurationVOErrors(
  baseError: DomainError,
  entityName: string,
): DurationVOErrors {
  return {
    invalid: () => ({
      ...baseError,
      detail: `${entityName} is not valid. Use formats like: 5000 (ms), '5s', '2m', '1h', '3d'`,
      context: {
        operation: 'duration_parsing',
      },
    }),

    negative: () => ({
      ...baseError,
      detail: `${entityName} cannot be negative`,
      context: {
        operation: 'negative_check',
      },
    }),

    tooPrecise: () => ({
      ...baseError,
      detail: `${entityName} must be a whole number of milliseconds`,
      context: {
        operation: 'precision_check',
      },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: {
        operation: 'required_check',
      },
    }),

    custom: (value: number, reason: string) => ({
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value,
        reason,
        operation: 'custom_validation',
      },
    }),
  };
}

export function createDurationVO(config: DurationVOConfig) {
  /**
   * Normalize duration based on configuration
   */
  const normalizeDuration = (ms: number): number => {
    if (!config.normalizeTo) return ms;

    switch (config.normalizeTo) {
      case 'seconds':
        return Math.round(ms / 1000) * 1000;
      case 'minutes':
        return Math.round(ms / (60 * 1000)) * (60 * 1000);
      case 'hours':
        return Math.round(ms / (60 * 60 * 1000)) * (60 * 60 * 1000);
      case 'days':
        return Math.round(ms / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
      default:
        return ms;
    }
  };

  /**
   * Duration Value Object implementation
   * Generated dynamically based on configuration
   */
  return class DurationVO implements DurationVOInstance {
    public readonly _value: number;

    protected constructor(ms: number) {
      this._value = ms;
    }

    /**
     * Create value object from string or number with validation
     */
    static create(
      input?: string | number | null,
    ): Result<DurationVO, DomainError> {
      try {
        // Check if value is required but not provided
        if (config.required && (input === undefined || input === null)) {
          return err(config.errors.required());
        }

        // If not required and no value provided, return error for type safety
        if (input === undefined || input === null) {
          return err(config.errors.invalid());
        }

        // Parse the input
        const ms = parseDuration(input, config);

        // Apply normalization
        const normalizedMs = normalizeDuration(ms);

        // Validate it's not negative (if nonNegative is true)
        if (config.nonNegative && normalizedMs < 0) {
          return err(config.errors.negative());
        }

        // Check minimum duration
        if (config.minMs !== undefined && normalizedMs < config.minMs) {
          return err(config.errors.invalid());
        }

        // Check maximum duration
        if (config.maxMs !== undefined && normalizedMs > config.maxMs) {
          return err(config.errors.invalid());
        }

        // Check if it's too precise (has fractional milliseconds)
        if (normalizedMs !== Math.floor(normalizedMs)) {
          return err(config.errors.tooPrecise());
        }

        // Apply refinements
        if (config.refinements) {
          if (
            config.refinements.minDuration &&
            !config.refinements.minDuration.test(normalizedMs)
          ) {
            return err(config.refinements.minDuration.error());
          }

          if (
            config.refinements.maxDuration &&
            !config.refinements.maxDuration.test(normalizedMs)
          ) {
            return err(config.refinements.maxDuration.error());
          }

          if (
            config.refinements.custom &&
            !config.refinements.custom.test(normalizedMs)
          ) {
            return err(config.refinements.custom.error());
          }
        }

        return ok(new DurationVO(normalizedMs));
      } catch {
        return err(config.errors.invalid());
      }
    }

    static from(value: DurationVO): Result<DurationVO, DomainError> {
      return ok(value);
    }

    toMilliseconds(): number {
      return this._value;
    }

    toSeconds(): number {
      return this._value / 1000;
    }

    toMinutes(): number {
      return this._value / (60 * 1000);
    }

    toHours(): number {
      return this._value / (60 * 60 * 1000);
    }

    toDays(): number {
      return this._value / (24 * 60 * 60 * 1000);
    }

    toHumanReadable(): string {
      const ms = this._value;
      if (ms < 1000) {
        return `${ms}ms`;
      } else if (ms < 60 * 1000) {
        return `${(ms / 1000).toFixed(1)}s`;
      } else if (ms < 60 * 60 * 1000) {
        return `${(ms / (60 * 1000)).toFixed(1)}m`;
      } else if (ms < 24 * 60 * 60 * 1000) {
        return `${(ms / (60 * 60 * 1000)).toFixed(1)}h`;
      } else {
        return `${(ms / (24 * 60 * 60 * 1000)).toFixed(1)}d`;
      }
    }

    add(other: DurationVO): DurationVO {
      return new DurationVO(this._value + other._value);
    }

    subtract(other: DurationVO): DurationVO {
      const result = this._value - other._value;
      if (result < 0) {
        throw new Error('Duration cannot be negative after subtraction');
      }
      return new DurationVO(result);
    }

    multiply(factor: number): DurationVO {
      if (factor < 0) {
        throw new Error('Factor cannot be negative');
      }
      return new DurationVO(this._value * factor);
    }

    divide(factor: number): DurationVO {
      if (factor <= 0) {
        throw new Error('Factor must be positive');
      }
      return new DurationVO(this._value / factor);
    }

    isLongerThan(other: DurationVO): boolean {
      return this._value > other._value;
    }

    isShorterThan(other: DurationVO): boolean {
      return this._value < other._value;
    }

    equals(other: DurationVO): boolean {
      return this._value === other._value;
    }

    compare(other: DurationVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    toString(): string {
      return this.toHumanReadable();
    }

    toJSON(): { type: 'duration'; value: number; unit: 'ms' } {
      return {
        type: 'duration',
        value: this._value,
        unit: 'ms',
      };
    }

    static get schema() {
      return z.union([z.string(), z.number()]).refine(
        (input) => {
          try {
            const ms = parseDuration(input, config);
            const normalizedMs = normalizeDuration(ms);

            if (config.nonNegative && normalizedMs < 0) return false;
            if (config.minMs !== undefined && normalizedMs < config.minMs)
              return false;
            if (config.maxMs !== undefined && normalizedMs > config.maxMs)
              return false;

            return normalizedMs === Math.floor(normalizedMs);
          } catch {
            return false;
          }
        },
        { message: `Invalid ${config.name}` },
      );
    }
  };
}
