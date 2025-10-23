import { Result, ok, err, DomainError } from '../../errors';

/**
 * Interface for defining datetime business rules/refinements
 */
export interface DateTimeRefinement {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: Date) => boolean;
  /** Create error when test fails */
  createError: (value: Date) => DomainError;
}

/**
 * Creates standardized error factory functions for datetime value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., EventErrors.INVALID_DATETIME)
 * @param entityName - Human-readable name for the entity (e.g., 'Event DateTime', 'Created At')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createDateTimeVOErrors } from 'src/shared/domain/value-objects/datetime-vo';
 * import { EventErrors } from '../errors/event.errors';
 *
 * export const EventDateTime = createDateTimeVO({
 *   name: 'EventDateTime',
 *   allowPast: false,
 *   errors: createDateTimeVOErrors(EventErrors.INVALID_DATETIME, 'Event DateTime'),
 * });
 * ```
 */
export function createDateTimeVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a Date or valid date string, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'Date',
        received: typeof value,
      },
    }),

    invalid: (value: string | number) => ({
      ...baseError,
      detail: `${entityName} must be a valid datetime, received: ${value}`,
      context: {
        value,
        operation: 'datetime_parsing',
      },
    }),

    tooEarly: (value: Date, minDateTime: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be before ${minDateTime.toISOString()}, received: ${value.toISOString()}`,
      context: {
        value: value.toISOString(),
        minDateTime: minDateTime.toISOString(),
        operation: 'datetime_range_check',
      },
    }),

    tooLate: (value: Date, maxDateTime: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be after ${maxDateTime.toISOString()}, received: ${value.toISOString()}`,
      context: {
        value: value.toISOString(),
        maxDateTime: maxDateTime.toISOString(),
        operation: 'datetime_range_check',
      },
    }),

    futureNotAllowed: (value: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be in the future, received: ${value.toISOString()}`,
      context: {
        value: value.toISOString(),
        operation: 'future_check',
      },
    }),

    pastNotAllowed: (value: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be in the past, received: ${value.toISOString()}`,
      context: {
        value: value.toISOString(),
        operation: 'past_check',
      },
    }),

    notBusinessDay: (value: Date) => ({
      ...baseError,
      detail: `${entityName} must be a business day (Monday-Friday), received: ${value.toDateString()}`,
      context: {
        value: value.toISOString(),
        dayOfWeek: value.getDay(),
        operation: 'business_day_check',
      },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: { operation: 'required_check' },
    }),

    custom: (value: Date, reason: string) => ({
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value: value.toISOString(),
        reason,
        operation: 'custom_validation',
      },
    }),
  };
}

export type DateTimeVOInstance = {
  readonly value: Date;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly milliseconds: number;
  readonly dayOfWeek: number;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly isPast: boolean;
  readonly isBusinessDay: boolean;
  readonly isWeekend: boolean;
  addDays(days: number): Result<DateTimeVOInstance, DomainError>;
  addHours(hours: number): Result<DateTimeVOInstance, DomainError>;
  addMinutes(minutes: number): Result<DateTimeVOInstance, DomainError>;
  addSeconds(seconds: number): Result<DateTimeVOInstance, DomainError>;
  addMilliseconds(
    milliseconds: number,
  ): Result<DateTimeVOInstance, DomainError>;
  addMonths(months: number): Result<DateTimeVOInstance, DomainError>;
  addYears(years: number): Result<DateTimeVOInstance, DomainError>;
  startOfDay(): Result<DateTimeVOInstance, DomainError>;
  endOfDay(): Result<DateTimeVOInstance, DomainError>;
  startOfHour(): Result<DateTimeVOInstance, DomainError>;
  endOfHour(): Result<DateTimeVOInstance, DomainError>;
  equals(other: DateTimeVOInstance): boolean;
  exactEquals(other: DateTimeVOInstance): boolean;
  compare(other: DateTimeVOInstance): -1 | 0 | 1;
  isBefore(other: DateTimeVOInstance): boolean;
  isAfter(other: DateTimeVOInstance): boolean;
  differenceInDays(other: DateTimeVOInstance): number;
  differenceInHours(other: DateTimeVOInstance): number;
  differenceInMinutes(other: DateTimeVOInstance): number;
  differenceInSeconds(other: DateTimeVOInstance): number;
  differenceInMilliseconds(other: DateTimeVOInstance): number;
  toISOString(): string;
  toDateString(): string;
  toTimeString(): string;
  toString(): string;
  toJSON(): { value: string; type: string };
};

/**
 * Configuration interface for datetime value objects
 */
export interface DateTimeVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Minimum allowed datetime */
  minDateTime?: Date;
  /** Maximum allowed datetime */
  maxDateTime?: Date;
  /** Allow future datetimes */
  allowFuture?: boolean;
  /** Allow past datetimes */
  allowPast?: boolean;
  /** Require datetime to be in business days only */
  businessDaysOnly?: boolean;
  /** Whether the value is required */
  required?: boolean;
  /** Minimum datetime as ISO string (alternative to minDateTime) */
  minIso?: string;
  /** Maximum datetime as ISO string (alternative to maxDateTime) */
  maxIso?: string;
  /** Normalize datetime to specific timezone or format */
  normalizeTo?: string;
  /** Business rule refinements for domain validation */
  refinements?: DateTimeRefinement[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: Date) => Result<void, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    invalid: (value: string | number) => DomainError;
    tooEarly: (value: Date, minDateTime: Date) => DomainError;
    tooLate: (value: Date, maxDateTime: Date) => DomainError;
    futureNotAllowed: (value: Date) => DomainError;
    pastNotAllowed: (value: Date) => DomainError;
    notBusinessDay: (value: Date) => DomainError;
    required: () => DomainError;
  };
}

/**
 * Factory function to create datetime-based value objects
 * Provides consistent validation and operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createDateTimeVO(config: DateTimeVOConfig) {
  // Configuration with defaults
  const ALLOW_FUTURE = config.allowFuture ?? true;
  const ALLOW_PAST = config.allowPast ?? true;
  const BUSINESS_DAYS_ONLY = config.businessDaysOnly ?? false;
  const REQUIRED = config.required ?? false;
  const MIN_DATETIME = config.minIso ? new Date(config.minIso) : undefined;
  const MAX_DATETIME = config.maxIso ? new Date(config.maxIso) : undefined;
  const NORMALIZE_TO = config.normalizeTo;

  /**
   * Check if datetime is a business day (Monday-Friday)
   */
  const isBusinessDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday = 1, Friday = 5
  };

  /**
   * Normalize datetime based on configuration
   */
  const normalizeDateTime = (value: Date): Date => {
    if (!NORMALIZE_TO) return value;

    const normalized = new Date(value);

    // Handle common normalization patterns
    switch (NORMALIZE_TO) {
      case 'startOfDay':
        normalized.setHours(0, 0, 0, 0);
        break;
      case 'endOfDay':
        normalized.setHours(23, 59, 59, 999);
        break;
      case 'startOfHour':
        normalized.setMinutes(0, 0, 0);
        break;
      case 'endOfHour':
        normalized.setMinutes(59, 59, 999);
        break;
      case 'utc': {
        // Convert to UTC by adjusting for timezone offset
        const utcTime =
          normalized.getTime() + normalized.getTimezoneOffset() * 60000;
        return new Date(utcTime);
      }
      default:
        // For other patterns like timezone strings, keep original behavior
        break;
    }

    return normalized;
  };

  /**
   * Validate datetime against configuration rules
   */
  const validate = (value: Date): Result<Date, DomainError> => {
    // Normalize the datetime if configured
    const normalizedValue = normalizeDateTime(value);
    const now = new Date();

    // Check future datetimes
    if (!ALLOW_FUTURE && normalizedValue > now) {
      return err(config.errors.futureNotAllowed(normalizedValue));
    }

    // Check past datetimes
    if (!ALLOW_PAST && normalizedValue < now) {
      return err(config.errors.pastNotAllowed(normalizedValue));
    }

    // Check minimum datetime (prioritize minIso over minDateTime)
    const minDateTime = MIN_DATETIME ?? config.minDateTime;
    if (minDateTime && normalizedValue < minDateTime) {
      return err(config.errors.tooEarly(normalizedValue, minDateTime));
    }

    // Check maximum datetime (prioritize maxIso over maxDateTime)
    const maxDateTime = MAX_DATETIME ?? config.maxDateTime;
    if (maxDateTime && normalizedValue > maxDateTime) {
      return err(config.errors.tooLate(normalizedValue, maxDateTime));
    }

    // Check business days
    if (BUSINESS_DAYS_ONLY && !isBusinessDay(normalizedValue)) {
      return err(config.errors.notBusinessDay(normalizedValue));
    }

    // Process refinements (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(normalizedValue)) {
          return err(refinement.createError(normalizedValue));
        }
      }
    }

    // Process custom validation
    if (config.customValidation) {
      const customResult = config.customValidation(normalizedValue);
      if (!customResult.ok) {
        return err(customResult.error);
      }
    }

    return ok(normalizedValue);
  };

  /**
   * DateTime Value Object implementation
   * Generated dynamically based on configuration
   */
  return class DateTimeVO {
    public readonly _value: Date;

    protected constructor(value: Date) {
      this._value = value;
    }

    /**
     * Create value object from Date with validation
     */
    static create(
      value?: string | Date | number | null,
    ): Result<DateTimeVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
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

      return ok(new DateTimeVO(new Date(validationResult.value)));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<DateTimeVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      if (value instanceof Date) {
        return this.create(value);
      }

      if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return this.create(parsed);
        }
        return err(config.errors.invalid(value));
      }

      return err(config.errors.type(value));
    }

    /**
     * Create from ISO string
     */
    static fromISOString(isoString: string): Result<DateTimeVO, DomainError> {
      try {
        const date = new Date(isoString);
        return this.create(date);
      } catch {
        return err(config.errors.invalid(isoString));
      }
    }

    /**
     * Create now (current date and time)
     */
    static now(): Result<DateTimeVO, DomainError> {
      return this.create(new Date());
    }

    // ==================== Accessors ====================

    /** Get the Date value */
    get value(): Date {
      return new Date(this._value);
    }

    /** Get year */
    get year(): number {
      return this._value.getFullYear();
    }

    /** Get month (0-11) */
    get month(): number {
      return this._value.getMonth();
    }

    /** Get day of month (1-31) */
    get day(): number {
      return this._value.getDate();
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

    /** Get day of week (0-6, Sunday = 0) */
    get dayOfWeek(): number {
      return this._value.getDay();
    }

    /** Check if datetime is today */
    get isToday(): boolean {
      const today = new Date();
      return (
        this._value.getFullYear() === today.getFullYear() &&
        this._value.getMonth() === today.getMonth() &&
        this._value.getDate() === today.getDate()
      );
    }

    /** Check if datetime is in the future */
    get isFuture(): boolean {
      return this._value > new Date();
    }

    /** Check if datetime is in the past */
    get isPast(): boolean {
      return this._value < new Date();
    }

    /** Check if datetime is a business day */
    get isBusinessDay(): boolean {
      return isBusinessDay(this._value);
    }

    /** Check if datetime is a weekend */
    get isWeekend(): boolean {
      const dayOfWeek = this._value.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    }

    // ==================== Operations ====================

    /**
     * Add days to the datetime (re-validates result)
     */
    addDays(days: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setDate(newDate.getDate() + days);
      return DateTimeVO.create(newDate);
    }

    /**
     * Add hours to the datetime (re-validates result)
     */
    addHours(hours: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setHours(newDate.getHours() + hours);
      return DateTimeVO.create(newDate);
    }

    /**
     * Add minutes to the datetime (re-validates result)
     */
    addMinutes(minutes: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMinutes(newDate.getMinutes() + minutes);
      return DateTimeVO.create(newDate);
    }

    /**
     * Add seconds to the datetime (re-validates result)
     */
    addSeconds(seconds: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setSeconds(newDate.getSeconds() + seconds);
      return DateTimeVO.create(newDate);
    }

    /**
     * Add milliseconds to the datetime (re-validates result)
     */
    addMilliseconds(milliseconds: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMilliseconds(newDate.getMilliseconds() + milliseconds);
      return DateTimeVO.create(newDate);
    }

    /**
     * Add months to the datetime (re-validates result)
     */
    addMonths(months: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMonth(newDate.getMonth() + months);
      return DateTimeVO.create(newDate);
    }

    /**
     * Add years to the datetime (re-validates result)
     */
    addYears(years: number): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setFullYear(newDate.getFullYear() + years);
      return DateTimeVO.create(newDate);
    }

    /**
     * Get start of day (00:00:00.000)
     */
    startOfDay(): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setHours(0, 0, 0, 0);
      return DateTimeVO.create(newDate);
    }

    /**
     * Get end of day (23:59:59.999)
     */
    endOfDay(): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setHours(23, 59, 59, 999);
      return DateTimeVO.create(newDate);
    }

    /**
     * Get start of hour (XX:00:00.000)
     */
    startOfHour(): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMinutes(0, 0, 0);
      return DateTimeVO.create(newDate);
    }

    /**
     * Get end of hour (XX:59:59.999)
     */
    endOfHour(): Result<DateTimeVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMinutes(59, 59, 999);
      return DateTimeVO.create(newDate);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another DateTimeVO (same day, ignoring time)
     */
    equals(other: DateTimeVO): boolean {
      return this._value.toDateString() === other._value.toDateString();
    }

    /**
     * Check exact equality including time
     */
    exactEquals(other: DateTimeVO): boolean {
      return this._value.getTime() === other._value.getTime();
    }

    /**
     * Compare with another DateTimeVO
     */
    compare(other: DateTimeVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Check if before another DateTimeVO
     */
    isBefore(other: DateTimeVO): boolean {
      return this._value < other._value;
    }

    /**
     * Check if after another DateTimeVO
     */
    isAfter(other: DateTimeVO): boolean {
      return this._value > other._value;
    }

    /**
     * Get difference in days
     */
    differenceInDays(other: DateTimeVO): number {
      const diffTime = Math.abs(this._value.getTime() - other._value.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Get difference in hours
     */
    differenceInHours(other: DateTimeVO): number {
      const diffTime = Math.abs(this._value.getTime() - other._value.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60));
    }

    /**
     * Get difference in minutes
     */
    differenceInMinutes(other: DateTimeVO): number {
      const diffTime = Math.abs(this._value.getTime() - other._value.getTime());
      return Math.ceil(diffTime / (1000 * 60));
    }

    /**
     * Get difference in seconds
     */
    differenceInSeconds(other: DateTimeVO): number {
      const diffTime = Math.abs(this._value.getTime() - other._value.getTime());
      return Math.ceil(diffTime / 1000);
    }

    /**
     * Get difference in milliseconds
     */
    differenceInMilliseconds(other: DateTimeVO): number {
      return Math.abs(this._value.getTime() - other._value.getTime());
    }

    // ==================== Serialization ====================

    /**
     * Convert to ISO string
     */
    toISOString(): string {
      return this._value.toISOString();
    }

    /**
     * Convert to date string (YYYY-MM-DD)
     */
    toDateString(): string {
      return this._value.toISOString().split('T')[0];
    }

    /**
     * Convert to time string (HH:MM:SS)
     */
    toTimeString(): string {
      return this._value.toTimeString().split(' ')[0];
    }

    /**
     * Convert to string representation
     */
    toString(): string {
      return this._value.toString();
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: string; type: string } {
      return {
        value: this._value.toISOString(),
        type: config.name,
      };
    }
  };
}
