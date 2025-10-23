import { Result, ok, err, DomainError } from '../../errors';

/**
 * Interface for defining date business rules/refinements
 */
export interface DateRefinement {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: Date) => boolean;
  /** Create error when test fails */
  createError: (value: Date) => DomainError;
}

/**
 * Creates standardized error factory functions for date value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., ProductErrors.INVALID_DATE)
 * @param entityName - Human-readable name for the entity (e.g., 'Start Date', 'Due Date')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createDateVOErrors } from 'src/shared/domain/value-objects/date-vo';
 * import { ProductErrors } from '../errors/product.errors';
 *
 * export const ProductLaunchDate = createDateVO({
 *   name: 'ProductLaunchDate',
 *   allowPast: false,
 *   errors: createDateVOErrors(ProductErrors.INVALID_LAUNCH_DATE, 'Launch Date'),
 * });
 * ```
 */
export function createDateVOErrors(baseError: DomainError, entityName: string) {
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
      detail: `${entityName} must be a valid date, received: ${value}`,
      context: {
        value,
        operation: 'date_parsing',
      },
    }),
    tooEarly: (value: Date, minDate: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be before ${minDate.toDateString()}, received: ${value.toDateString()}`,
      context: {
        value: value.toISOString(),
        minDate: minDate.toISOString(),
        operation: 'date_range_check',
      },
    }),
    tooLate: (value: Date, maxDate: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be after ${maxDate.toDateString()}, received: ${value.toDateString()}`,
      context: {
        value: value.toISOString(),
        maxDate: maxDate.toISOString(),
        operation: 'date_range_check',
      },
    }),
    futureNotAllowed: (value: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be in the future, received: ${value.toDateString()}`,
      context: {
        value: value.toISOString(),
        operation: 'future_check',
      },
    }),
    pastNotAllowed: (value: Date) => ({
      ...baseError,
      detail: `${entityName} cannot be in the past, received: ${value.toDateString()}`,
      context: {
        value: value.toISOString(),
        operation: 'past_check',
      },
    }),
    businessDayRequired: (value: Date) => ({
      ...baseError,
      detail: `${entityName} must be a business day (Monday-Friday), received: ${value.toDateString()}`,
      context: {
        value: value.toISOString(),
        dayOfWeek: value.getDay(),
        operation: 'business_day_check',
      },
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

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: { operation: 'required_check' },
    }),
  };
}

export type DateVOInstance = {
  readonly value: Date;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly dayOfWeek: number;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly isPast: boolean;
  readonly isBusinessDay: boolean;
  readonly isWeekend: boolean;
  addDays(days: number): Result<DateVOInstance, DomainError>;
  addMonths(months: number): Result<DateVOInstance, DomainError>;
  addYears(years: number): Result<DateVOInstance, DomainError>;
  startOfDay(): Result<DateVOInstance, DomainError>;
  endOfDay(): Result<DateVOInstance, DomainError>;
  equals(other: DateVOInstance): boolean;
  exactEquals(other: DateVOInstance): boolean;
  compare(other: DateVOInstance): -1 | 0 | 1;
  isBefore(other: DateVOInstance): boolean;
  isAfter(other: DateVOInstance): boolean;
  differenceInDays(other: DateVOInstance): number;
  toISOString(): string;
  toDateString(): string;
  toString(): string;
  toJSON(): { value: string; type: string };
};

/**
 * Configuration interface for date value objects
 */
export interface DateVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Minimum allowed date */
  minDate?: Date;
  /** Maximum allowed date */
  maxDate?: Date;
  /** Allow future dates */
  allowFuture?: boolean;
  /** Allow past dates */
  allowPast?: boolean;
  /** Require date to be in business days only */
  businessDaysOnly?: boolean;
  /** Whether the value is required */
  required?: boolean;
  /** Minimum date as ISO string (alternative to minDate) */
  minIso?: string;
  /** Maximum date as ISO string (alternative to maxDate) */
  maxIso?: string;
  /** Business rule refinements for domain validation */
  refinements?: DateRefinement[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: Date) => Result<void, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    invalid: (value: string | number) => DomainError;
    tooEarly: (value: Date, minDate: Date) => DomainError;
    tooLate: (value: Date, maxDate: Date) => DomainError;
    futureNotAllowed: (value: Date) => DomainError;
    pastNotAllowed: (value: Date) => DomainError;
    businessDayRequired: (value: Date) => DomainError;
    custom: (value: Date, reason: string) => DomainError;
    required: () => DomainError;
  };
}

/**
 * Factory function to create date-based value objects
 * Provides consistent validation and operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createDateVO(config: DateVOConfig) {
  // Configuration with defaults
  const ALLOW_FUTURE = config.allowFuture ?? true;
  const ALLOW_PAST = config.allowPast ?? true;
  const BUSINESS_DAYS_ONLY = config.businessDaysOnly ?? false;
  const REQUIRED = config.required ?? false;
  const MIN_DATE = config.minIso ? new Date(config.minIso) : undefined;
  const MAX_DATE = config.maxIso ? new Date(config.maxIso) : undefined;

  /**
   * Check if date is a business day (Monday-Friday)
   */
  const isBusinessDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday = 1, Friday = 5
  };

  /**
   * Validate date against configuration rules
   */
  const validate = (value: Date): Result<Date, DomainError> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const valueDate = new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
    );

    // Check future dates
    if (!ALLOW_FUTURE && valueDate > today) {
      return err(config.errors.futureNotAllowed(value));
    }

    // Check past dates
    if (!ALLOW_PAST && valueDate < today) {
      return err(config.errors.pastNotAllowed(value));
    }

    // Check minimum date (prioritize minIso over minDate)
    const minDate = MIN_DATE ?? config.minDate;
    if (minDate && value < minDate) {
      return err(config.errors.tooEarly(value, minDate));
    }

    // Check maximum date (prioritize maxIso over maxDate)
    const maxDate = MAX_DATE ?? config.maxDate;
    if (maxDate && value > maxDate) {
      return err(config.errors.tooLate(value, maxDate));
    }

    // Check business days
    if (BUSINESS_DAYS_ONLY && !isBusinessDay(value)) {
      return err(config.errors.businessDayRequired(value));
    }

    // Process refinements (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(value)) {
          return err(refinement.createError(value));
        }
      }
    }

    // Process custom validation
    if (config.customValidation) {
      const customResult = config.customValidation(value);
      if (!customResult.ok) {
        return err(customResult.error);
      }
    }

    return ok(value);
  };

  /**
   * Date Value Object implementation
   * Generated dynamically based on configuration
   */
  return class DateVO {
    public readonly _value: Date;

    protected constructor(value: Date) {
      this._value = value;
    }

    /**
     * Create value object from Date with validation
     */
    static create(value?: Date | string | null): Result<DateVO, DomainError> {
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

      return ok(new DateVO(new Date(validationResult.value)));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<DateVO, DomainError> {
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
    static fromISOString(isoString: string): Result<DateVO, DomainError> {
      try {
        const date = new Date(isoString);
        return this.create(date);
      } catch {
        return err(config.errors.invalid(isoString));
      }
    }

    /**
     * Create today's date
     */
    static today(): Result<DateVO, DomainError> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return this.create(today);
    }

    /**
     * Create now (current date and time)
     */
    static now(): Result<DateVO, DomainError> {
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

    /** Get day of week (0-6, Sunday = 0) */
    get dayOfWeek(): number {
      return this._value.getDay();
    }

    /** Check if date is today */
    get isToday(): boolean {
      const today = new Date();
      return this._value.toDateString() === today.toDateString();
    }

    /** Check if date is in the future */
    get isFuture(): boolean {
      return this._value > new Date();
    }

    /** Check if date is in the past */
    get isPast(): boolean {
      return this._value < new Date();
    }

    /** Check if date is a business day */
    get isBusinessDay(): boolean {
      return isBusinessDay(this._value);
    }

    /** Check if date is a weekend */
    get isWeekend(): boolean {
      const dayOfWeek = this._value.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    }

    // ==================== Operations ====================

    /**
     * Add days to the date (re-validates result)
     */
    addDays(days: number): Result<DateVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setDate(newDate.getDate() + days);
      return DateVO.create(newDate);
    }

    /**
     * Add months to the date (re-validates result)
     */
    addMonths(months: number): Result<DateVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setMonth(newDate.getMonth() + months);
      return DateVO.create(newDate);
    }

    /**
     * Add years to the date (re-validates result)
     */
    addYears(years: number): Result<DateVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setFullYear(newDate.getFullYear() + years);
      return DateVO.create(newDate);
    }

    /**
     * Get start of day (00:00:00)
     */
    startOfDay(): Result<DateVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setHours(0, 0, 0, 0);
      return DateVO.create(newDate);
    }

    /**
     * Get end of day (23:59:59.999)
     */
    endOfDay(): Result<DateVO, DomainError> {
      const newDate = new Date(this._value);
      newDate.setHours(23, 59, 59, 999);
      return DateVO.create(newDate);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another DateVO (same day, ignoring time)
     */
    equals(other: DateVO): boolean {
      return this._value.toDateString() === other._value.toDateString();
    }

    /**
     * Check exact equality including time
     */
    exactEquals(other: DateVO): boolean {
      return this._value.getTime() === other._value.getTime();
    }

    /**
     * Compare with another DateVO
     */
    compare(other: DateVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Check if before another DateVO
     */
    isBefore(other: DateVO): boolean {
      return this._value < other._value;
    }

    /**
     * Check if after another DateVO
     */
    isAfter(other: DateVO): boolean {
      return this._value > other._value;
    }

    /**
     * Get difference in days
     */
    differenceInDays(other: DateVO): number {
      const diffTime = Math.abs(this._value.getTime() - other._value.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
