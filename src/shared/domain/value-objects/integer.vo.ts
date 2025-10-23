import { Result, ok, err, DomainError } from '../../errors';

/**
 * Creates standardized error factory functions for integer value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity (e.g., 'Item Count', 'Retry Attempts')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createIntegerVOErrors } from 'src/shared/domain/value-objects/integer-vo';
 * import { OrderErrors } from '../errors/order.errors';
 *
 * export const ItemCount = createIntegerVO({
 *   name: 'ItemCount',
 *   allowNegative: false,
 *   min: 1,
 *   errors: createIntegerVOErrors(OrderErrors.INVALID_COUNT, 'Item Count'),
 * });
 * ```
 */
export function createIntegerVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a number, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'number',
        received: typeof value,
      },
    }),

    notFinite: (value: number) => ({
      ...baseError,
      detail: `${entityName} must be a finite number`,
      context: { value, operation: 'finite_check' },
    }),

    tooSmall: (value: number, min: number) => ({
      ...baseError,
      detail: `${entityName} must be at least ${min}`,
      context: {
        value,
        minValue: min,
        operation: 'range_check',
      },
    }),

    tooLarge: (value: number, max: number) => ({
      ...baseError,
      detail: `${entityName} cannot exceed ${max}`,
      context: {
        value,
        maxValue: max,
        operation: 'range_check',
      },
    }),

    tooManyDecimals: (value: number, maxDecimals: number) => ({
      ...baseError,
      detail: `${entityName} cannot have more than ${maxDecimals} decimal places`,
      context: {
        value,
        maxDecimals,
        operation: 'decimal_check',
      },
    }),

    negativeNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} cannot be negative`,
      context: { value, operation: 'negative_check' },
    }),

    zeroNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} cannot be zero`,
      context: { value, operation: 'zero_check' },
    }),

    decimalsNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} must be a whole number`,
      context: { value, operation: 'integer_check' },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: { operation: 'required_check' },
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

/**
 * Refinement interface for custom integer business rules
 */
export interface IntegerRefinement {
  /** Unique name for the refinement rule */
  name: string;
  /** Test function that returns true if value passes validation */
  test: (value: number) => boolean;
  /** Error factory function called when test fails */
  createError: (value: number) => DomainError;
}

export type IntegerVOInstance = {
  readonly value: number;
  readonly isZero: boolean;
  readonly isPositive: boolean;
  readonly isNegative: boolean;
  readonly isInteger: boolean;
  add(other: IntegerVOInstance): Result<IntegerVOInstance, DomainError>;
  subtract(other: IntegerVOInstance): Result<IntegerVOInstance, DomainError>;
  multiply(other: IntegerVOInstance): Result<IntegerVOInstance, DomainError>;
  divide(other: IntegerVOInstance): Result<IntegerVOInstance, DomainError>;
  abs(): Result<IntegerVOInstance, DomainError>;
  round(decimals?: number): Result<IntegerVOInstance, DomainError>;
  equals(other: IntegerVOInstance): boolean;
  compare(other: IntegerVOInstance): -1 | 0 | 1;
  greaterThan(other: IntegerVOInstance): boolean;
  lessThan(other: IntegerVOInstance): boolean;
  greaterThanOrEqual(other: IntegerVOInstance): boolean;
  lessThanOrEqual(other: IntegerVOInstance): boolean;
  toString(): string;
  toJSON(): { value: number; type: string };
};

/**
 * Configuration interface for number value objects
 */
export interface IntegerVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Allow decimal numbers */
  allowDecimals?: boolean;
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
  /** Number of decimal places (if allowDecimals is true) */
  decimalPlaces?: number;
  /** Allow negative numbers */
  allowNegative?: boolean;
  /** Allow zero */
  allowZero?: boolean;
  /** Whether the value is required */
  required?: boolean;
  /** Business rule refinements for additional validation */
  refinements?: IntegerRefinement[];
  /** Custom validation function for business rules */
  customValidation?: (value: number) => Result<number, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    notFinite: (value: number) => DomainError;
    tooSmall: (value: number, min: number) => DomainError;
    tooLarge: (value: number, max: number) => DomainError;
    tooManyDecimals: (value: number, maxDecimals: number) => DomainError;
    negativeNotAllowed: (value: number) => DomainError;
    zeroNotAllowed: (value: number) => DomainError;
    decimalsNotAllowed: (value: number) => DomainError;
    required: () => DomainError;
    custom?: (value: number, reason: string) => DomainError;
  };
}

/**
 * Factory function to create number-based value objects
 * Provides consistent validation and operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createIntegerVO(config: IntegerVOConfig) {
  // Configuration with defaults
  const ALLOW_NEGATIVE = config.allowNegative ?? true;
  const ALLOW_ZERO = config.allowZero ?? true;
  const REQUIRED = config.required ?? false;

  /**
   * Validate number against configuration rules
   */
  const validate = (value: number): Result<number, DomainError> => {
    // Check if number is finite
    if (!Number.isFinite(value)) {
      return err(config.errors.notFinite(value));
    }

    // Check negative numbers
    if (!ALLOW_NEGATIVE && value < 0) {
      return err(config.errors.negativeNotAllowed(value));
    }

    // Check zero
    if (!ALLOW_ZERO && value === 0) {
      return err(config.errors.zeroNotAllowed(value));
    }

    // Check decimal places
    if (!(config.allowDecimals ?? true) && !Number.isInteger(value)) {
      return err(config.errors.decimalsNotAllowed(value));
    }

    // Check decimal places precision
    if (
      (config.allowDecimals ?? true) &&
      typeof config.decimalPlaces === 'number'
    ) {
      const decimalStr = value.toString();
      const decimalIndex = decimalStr.indexOf('.');
      if (decimalIndex !== -1) {
        const actualDecimals = decimalStr.length - decimalIndex - 1;
        if (actualDecimals > config.decimalPlaces) {
          return err(
            config.errors.tooManyDecimals(value, config.decimalPlaces),
          );
        }
      }
    }

    // Check minimum value
    if (typeof config.min === 'number' && value < config.min) {
      return err(config.errors.tooSmall(value, config.min));
    }

    // Check maximum value
    if (typeof config.max === 'number' && value > config.max) {
      return err(config.errors.tooLarge(value, config.max));
    }

    // Process refinements
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(value)) {
          return err(refinement.createError(value));
        }
      }
    }

    // Custom validation (for business rules)
    if (config.customValidation) {
      const customResult = config.customValidation(value);
      if (!customResult.ok) {
        return customResult;
      }
    }

    return ok(value);
  };

  /**
   * Integer Value Object implementation
   * Generated dynamically based on configuration
   */
  return class IntegerVO {
    public readonly _value: number;

    protected constructor(value: number) {
      this._value = value;
    }

    /**
     * Create value object from number with validation
     */
    static create(
      value?: number | string | null,
    ): Result<IntegerVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      const parsed = typeof value === 'string' ? Number(value) : value;
      if (typeof parsed !== 'number') {
        return err(config.errors.type(value));
      }

      const validationResult = validate(parsed);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new IntegerVO(validationResult.value));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<IntegerVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      if (typeof value === 'number') {
        return this.create(value);
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return this.create(parsed);
        }
      }

      return err(config.errors.type(value));
    }

    // ==================== Accessors ====================

    /** Get the number value */
    get value(): number {
      return this._value;
    }

    /** Check if number is zero */
    get isZero(): boolean {
      return this._value === 0;
    }

    /** Check if number is positive */
    get isPositive(): boolean {
      return this._value > 0;
    }

    /** Check if number is negative */
    get isNegative(): boolean {
      return this._value < 0;
    }

    /** Check if number is integer */
    get isInteger(): boolean {
      return Number.isInteger(this._value);
    }

    // ==================== Operations ====================

    /**
     * Add another IntegerVO (re-validates result)
     */
    add(other: IntegerVO): Result<IntegerVO, DomainError> {
      const sum = this._value + other._value;
      return IntegerVO.create(sum);
    }

    /**
     * Subtract another IntegerVO (re-validates result)
     */
    subtract(other: IntegerVO): Result<IntegerVO, DomainError> {
      const difference = this._value - other._value;
      return IntegerVO.create(difference);
    }

    /**
     * Multiply by another IntegerVO (re-validates result)
     */
    multiply(other: IntegerVO): Result<IntegerVO, DomainError> {
      const product = this._value * other._value;
      return IntegerVO.create(product);
    }

    /**
     * Divide by another IntegerVO (re-validates result)
     */
    divide(other: IntegerVO): Result<IntegerVO, DomainError> {
      if (other._value === 0) {
        return err(config.errors.type('Division by zero'));
      }
      const quotient = this._value / other._value;
      return IntegerVO.create(quotient);
    }

    /**
     * Get absolute value (re-validates result)
     */
    abs(): Result<IntegerVO, DomainError> {
      const absolute = Math.abs(this._value);
      return IntegerVO.create(absolute);
    }

    /**
     * Round to specified decimal places (re-validates result)
     */
    round(decimals: number = 0): Result<IntegerVO, DomainError> {
      const factor = Math.pow(10, decimals);
      const rounded = Math.round(this._value * factor) / factor;
      return IntegerVO.create(rounded);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another IntegerVO
     */
    equals(other: IntegerVO): boolean {
      return this._value === other._value;
    }

    /**
     * Compare with another IntegerVO
     */
    compare(other: IntegerVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Check if greater than another IntegerVO
     */
    /**
     * Check if greater than another IntegerVO
     */
    greaterThan(other: IntegerVO): boolean {
      return this._value > other._value;
    }

    /**
     * Check if less than another IntegerVO
     */
    lessThan(other: IntegerVO): boolean {
      return this._value < other._value;
    }

    /**
     * Check if greater than or equal to another IntegerVO
     */
    greaterThanOrEqual(other: IntegerVO): boolean {
      return this._value >= other._value;
    }

    /**
     * Check if less than or equal to another IntegerVO
     */
    lessThanOrEqual(other: IntegerVO): boolean {
      return this._value <= other._value;
    }

    // ==================== Serialization ====================

    /**
     * Convert to string representation
     */
    toString(): string {
      return this._value.toString();
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: number; type: string } {
      return {
        value: this._value,
        type: config.name,
      };
    }
  };
}
