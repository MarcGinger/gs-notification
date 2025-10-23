import { Result, ok, err, DomainError } from '../../errors';

/**
 * Interface for defining time business rules/refinements
 */
export interface TimeRefinement {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: Date) => boolean;
  /** Create error when test fails */
  createError: (value: Date) => DomainError;
}

/**
 * Creates standardized error factory functions for time value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., ScheduleErrors.INVALID_TIME)
 * @param entityName - Human-readable name for the entity (e.g., 'Start Time', 'End Time')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createTimeVOErrors } from 'src/shared/domain/value-objects/time-vo';
 * import { ScheduleErrors } from '../errors/schedule.errors';
 *
 * export const MeetingTime = createTimeVO({
 *   name: 'MeetingTime',
 *   minTime: new Date(1970, 0, 1, 9, 0), // 9:00 AM
 *   maxTime: new Date(1970, 0, 1, 17, 0), // 5:00 PM
 *   errors: createTimeVOErrors(ScheduleErrors.INVALID_TIME, 'Meeting Time'),
 * });
 * ```
 */
export function createTimeVOErrors(baseError: DomainError, entityName: string) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a Date or valid time string, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'Date',
        received: typeof value,
      },
    }),

    invalid: (value: string | number) => ({
      ...baseError,
      detail: `${entityName} must be a valid time, received: ${value}`,
      context: {
        value,
        operation: 'time_parsing',
      },
    }),

    tooEarly: (value: Date, minTime: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be before ${minTime.toTimeString()}, received: ${value.toTimeString()}`,
      context: {
        value: value.toTimeString(),
        minTime: minTime.toTimeString(),
        operation: 'time_range_check',
      },
    }),

    tooLate: (value: Date, maxTime: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be after ${maxTime.toTimeString()}, received: ${value.toTimeString()}`,
      context: {
        value: value.toTimeString(),
        maxTime: maxTime.toTimeString(),
        operation: 'time_range_check',
      },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: {
        operation: 'required_validation',
      },
    }),

    custom: (value: Date, reason: string) => ({
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value: value.toTimeString(),
        reason,
        operation: 'custom_validation',
      },
    }),
  };
}

export type TimeVOInstance = {
  readonly value: Date;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly milliseconds: number;
  readonly totalMilliseconds: number;
  readonly totalSeconds: number;
  readonly totalMinutes: number;
  addHours(hours: number): Result<TimeVOInstance, DomainError>;
  addMinutes(minutes: number): Result<TimeVOInstance, DomainError>;
  addSeconds(seconds: number): Result<TimeVOInstance, DomainError>;
  addMilliseconds(milliseconds: number): Result<TimeVOInstance, DomainError>;
  equals(other: TimeVOInstance): boolean;
  exactEquals(other: TimeVOInstance): boolean;
  compare(other: TimeVOInstance): -1 | 0 | 1;
  isBefore(other: TimeVOInstance): boolean;
  isAfter(other: TimeVOInstance): boolean;
  differenceInHours(other: TimeVOInstance): number;
  differenceInMinutes(other: TimeVOInstance): number;
  differenceInSeconds(other: TimeVOInstance): number;
  differenceInMilliseconds(other: TimeVOInstance): number;
  toISOString(): string;
  toTimeString(): string;
  toString(): string;
  toJSON(): { value: string; type: string };
};

/**
 * Configuration interface for time value objects
 */
export interface TimeVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Minimum allowed time */
  minTime?: Date;
  /** Maximum allowed time */
  maxTime?: Date;
  /** Business rule refinements for domain validation */
  refinements?: TimeRefinement[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: Date) => Result<void, DomainError>;
  /** Whether the value is required */
  required?: boolean;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    invalid: (value: string | number) => DomainError;
    tooEarly: (value: Date, minTime: Date) => DomainError;
    tooLate: (value: Date, maxTime: Date) => DomainError;
    required?: () => DomainError;
  };
}

/**
 * Factory function to create time-based value objects
 * Provides consistent validation and operations for time values
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createTimeVO(config: TimeVOConfig) {
  /**
   * Normalize time to a fixed date (1970-01-01) to focus only on time components
   */
  const normalizeToTime = (date: Date): Date => {
    const normalized = new Date(1970, 0, 1); // 1970-01-01
    normalized.setHours(
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    );
    return normalized;
  };

  /**
   * Validate time against configuration rules
   */
  const validate = (value: Date): Result<Date, DomainError> => {
    const normalizedTime = normalizeToTime(value);

    // Check minimum time
    if (config.minTime) {
      const minNormalized = normalizeToTime(config.minTime);
      if (normalizedTime < minNormalized) {
        return err(config.errors.tooEarly(value, config.minTime));
      }
    }

    // Check maximum time
    if (config.maxTime) {
      const maxNormalized = normalizeToTime(config.maxTime);
      if (normalizedTime > maxNormalized) {
        return err(config.errors.tooLate(value, config.maxTime));
      }
    }

    // Process refinements (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(normalizedTime)) {
          return err(refinement.createError(normalizedTime));
        }
      }
    }

    // Process custom validation
    if (config.customValidation) {
      const customResult = config.customValidation(normalizedTime);
      if (!customResult.ok) {
        return err(customResult.error);
      }
    }

    return ok(normalizedTime);
  };

  /**
   * Time Value Object implementation
   * Generated dynamically based on configuration
   */
  return class TimeVO {
    public readonly _value: Date;

    protected constructor(value: Date) {
      this._value = value;
    }

    /**
     * Create value object from Date with validation
     */
    static create(
      value?: Date | string | number | null,
    ): Result<TimeVO, DomainError> {
      // Check if value is required but not provided
      if (config.required && (value === undefined || value === null)) {
        return err(config.errors.required?.() || config.errors.type(value));
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      if (!(value instanceof Date)) {
        return err(config.errors.type(value));
      }

      if (isNaN(value.getTime())) {
        return err(config.errors.invalid(value.toString()));
      }

      const validationResult = validate(value);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new TimeVO(validationResult.value));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<TimeVO, DomainError> {
      if (value instanceof Date) {
        return this.create(value);
      }

      if (typeof value === 'string') {
        // Try parsing as HH:MM:SS format first
        const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
        const match = value.match(timeRegex);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = match[3] ? parseInt(match[3], 10) : 0;
          const milliseconds = match[4] ? parseInt(match[4], 10) : 0;

          if (
            hours >= 0 &&
            hours <= 23 &&
            minutes >= 0 &&
            minutes <= 59 &&
            seconds >= 0 &&
            seconds <= 59
          ) {
            const date = new Date();
            date.setHours(hours, minutes, seconds, milliseconds);
            return this.create(date);
          }
        }

        // Try parsing as ISO string
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return this.create(parsed);
        }
        return err(config.errors.invalid(value));
      }

      if (typeof value === 'number') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return this.create(date);
        }
        return err(config.errors.invalid(value));
      }

      return err(config.errors.type(value));
    }

    /**
     * Create from time string (HH:MM:SS)
     */
    static fromTimeString(timeString: string): Result<TimeVO, DomainError> {
      return this.from(timeString);
    }

    /**
     * Create now (current time)
     */
    static now(): Result<TimeVO, DomainError> {
      return this.create(new Date());
    }

    // ==================== Accessors ====================

    /** Get the Date value (normalized to 1970-01-01) */
    get value(): Date {
      return new Date(this._value);
    }

    /** Get hours (0-23) */
    get hours(): number {
      return this._value.getHours();
    }

    /** Get minutes (0-59) */
    get minutes(): number {
      return this._value.getMinutes();
    }

    /** Get seconds (0-59) */
    get seconds(): number {
      return this._value.getSeconds();
    }

    /** Get milliseconds (0-999) */
    get milliseconds(): number {
      return this._value.getMilliseconds();
    }

    /** Get total milliseconds since midnight */
    get totalMilliseconds(): number {
      return (
        this._value.getHours() * 3600000 +
        this._value.getMinutes() * 60000 +
        this._value.getSeconds() * 1000 +
        this._value.getMilliseconds()
      );
    }

    /** Get total seconds since midnight */
    get totalSeconds(): number {
      return Math.floor(this.totalMilliseconds / 1000);
    }

    /** Get total minutes since midnight */
    get totalMinutes(): number {
      return Math.floor(this.totalMilliseconds / 60000);
    }

    // ==================== Operations ====================

    /**
     * Add hours to the time (re-validates result)
     */
    addHours(hours: number): Result<TimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setHours(newDate.getHours() + hours);
      return TimeVO.create(newDate);
    }

    /**
     * Add minutes to the time (re-validates result)
     */
    addMinutes(minutes: number): Result<TimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMinutes(newDate.getMinutes() + minutes);
      return TimeVO.create(newDate);
    }

    /**
     * Add seconds to the time (re-validates result)
     */
    addSeconds(seconds: number): Result<TimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setSeconds(newDate.getSeconds() + seconds);
      return TimeVO.create(newDate);
    }

    /**
     * Add milliseconds to the time (re-validates result)
     */
    addMilliseconds(milliseconds: number): Result<TimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMilliseconds(newDate.getMilliseconds() + milliseconds);
      return TimeVO.create(newDate);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another TimeVO
     */
    equals(other: TimeVO): boolean {
      return this.totalMilliseconds === other.totalMilliseconds;
    }

    /**
     * Check exact equality including milliseconds
     */
    exactEquals(other: TimeVO): boolean {
      return this._value.getTime() === other._value.getTime();
    }

    /**
     * Compare with another TimeVO
     */
    compare(other: TimeVO): -1 | 0 | 1 {
      if (this.totalMilliseconds < other.totalMilliseconds) return -1;
      if (this.totalMilliseconds > other.totalMilliseconds) return 1;
      return 0;
    }

    /**
     * Check if before another TimeVO
     */
    isBefore(other: TimeVO): boolean {
      return this.totalMilliseconds < other.totalMilliseconds;
    }

    /**
     * Check if after another TimeVO
     */
    isAfter(other: TimeVO): boolean {
      return this.totalMilliseconds > other.totalMilliseconds;
    }

    /**
     * Get difference in hours
     */
    differenceInHours(other: TimeVO): number {
      const diff = Math.abs(this.totalMilliseconds - other.totalMilliseconds);
      return Math.floor(diff / 3600000);
    }

    /**
     * Get difference in minutes
     */
    differenceInMinutes(other: TimeVO): number {
      const diff = Math.abs(this.totalMilliseconds - other.totalMilliseconds);
      return Math.floor(diff / 60000);
    }

    /**
     * Get difference in seconds
     */
    differenceInSeconds(other: TimeVO): number {
      const diff = Math.abs(this.totalMilliseconds - other.totalMilliseconds);
      return Math.floor(diff / 1000);
    }

    /**
     * Get difference in milliseconds
     */
    differenceInMilliseconds(other: TimeVO): number {
      return Math.abs(this.totalMilliseconds - other.totalMilliseconds);
    }

    // ==================== Serialization ====================

    /**
     * Convert to ISO string (returns time part only)
     */
    toISOString(): string {
      return this._value.toISOString().split('T')[1].split('.')[0];
    }

    /**
     * Convert to time string (HH:MM:SS.mmm)
     */
    toTimeString(): string {
      const hours = this._value.getHours().toString().padStart(2, '0');
      const minutes = this._value.getMinutes().toString().padStart(2, '0');
      const seconds = this._value.getSeconds().toString().padStart(2, '0');
      const milliseconds = this._value
        .getMilliseconds()
        .toString()
        .padStart(3, '0');
      return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * Convert to string representation
     */
    toString(): string {
      return this.toTimeString();
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: string; type: string } {
      return {
        value: this.toTimeString(),
        type: config.name,
      };
    }
  };
}
