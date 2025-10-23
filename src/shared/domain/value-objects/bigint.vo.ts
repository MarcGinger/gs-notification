import { Result, ok, err, DomainError } from '../../errors';

/**
 * Creates standardized error factory functions for bigint value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity (e.g., 'Account Balance', 'Transaction Amount')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createBigIntVOErrors } from 'src/shared/domain/value-objects/bigint-vo';
 * import { AccountErrors } from '../errors/account.errors';
 *
 * export const AccountBalance = createBigIntVO({
 *   name: 'AccountBalance',
 *   allowNegative: false,
 *   errors: createBigIntVOErrors(AccountErrors.INVALID_BALANCE, 'Account Balance'),
 * });
 * ```
 */
export function createBigIntVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a bigint, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'bigint',
        received: typeof value,
      },
    }),

    tooSmall: (value: bigint, min: bigint) => ({
      ...baseError,
      detail: `${entityName} must be at least ${min.toString()}`,
      context: {
        value: value.toString(),
        minValue: min.toString(),
        operation: 'range_check',
      },
    }),

    tooLarge: (value: bigint, max: bigint) => ({
      ...baseError,
      detail: `${entityName} cannot exceed ${max.toString()}`,
      context: {
        value: value.toString(),
        maxValue: max.toString(),
        operation: 'range_check',
      },
    }),

    negativeNotAllowed: (value: bigint) => ({
      ...baseError,
      detail: `${entityName} cannot be negative`,
      context: { value: value.toString(), operation: 'negative_check' },
    }),

    zeroNotAllowed: (value: bigint) => ({
      ...baseError,
      detail: `${entityName} cannot be zero`,
      context: { value: value.toString(), operation: 'zero_check' },
    }),

    divisionByZero: (value: bigint) => ({
      ...baseError,
      detail: `${entityName} division by zero is not allowed`,
      context: { value: value.toString(), operation: 'division_check' },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: { operation: 'required_check' },
    }),

    custom: (value: bigint, reason: string) => ({
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value: value.toString(),
        reason,
        operation: 'custom_validation',
      },
    }),
  };
}

/**
 * Refinement interface for custom bigint business rules
 */
export interface BigIntRefinement {
  /** Unique name for the refinement rule */
  name: string;
  /** Test function that returns true if value passes validation */
  test: (value: bigint) => boolean;
  /** Error factory function called when test fails */
  createError: (value: bigint) => DomainError;
}

export type BigIntVOInstance = {
  readonly value: bigint;
  readonly isZero: boolean;
  readonly isPositive: boolean;
  readonly isNegative: boolean;
  readonly isEven: boolean;
  readonly isOdd: boolean;
  add(other: BigIntVOInstance): Result<BigIntVOInstance, DomainError>;
  subtract(other: BigIntVOInstance): Result<BigIntVOInstance, DomainError>;
  multiply(other: BigIntVOInstance): Result<BigIntVOInstance, DomainError>;
  divide(other: BigIntVOInstance): Result<BigIntVOInstance, DomainError>;
  mod(other: BigIntVOInstance): Result<BigIntVOInstance, DomainError>;
  pow(exponent: number): Result<BigIntVOInstance, DomainError>;
  abs(): Result<BigIntVOInstance, DomainError>;
  negate(): Result<BigIntVOInstance, DomainError>;
  equals(other: BigIntVOInstance): boolean;
  compare(other: BigIntVOInstance): -1 | 0 | 1;
  greaterThan(other: BigIntVOInstance): boolean;
  lessThan(other: BigIntVOInstance): boolean;
  toString(): string;
  toJSON(): { value: string; type: string };
};

/**
 * Configuration interface for bigint value objects
 */
export interface BigIntVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Minimum value (inclusive) */
  min?: bigint;
  /** Maximum value (inclusive) */
  max?: bigint;
  /** Allow negative numbers */
  allowNegative?: boolean;
  /** Allow zero */
  allowZero?: boolean;
  /** Whether the value is required */
  required?: boolean;
  /** Minimum value (alternative to min) */
  minValue?: string | bigint;
  /** Maximum value (alternative to max) */
  maxValue?: string | bigint;
  /** Business rule refinements for additional validation */
  refinements?: BigIntRefinement[];
  /** Custom validation function for business rules */
  customValidation?: (value: bigint) => Result<bigint, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    tooSmall: (value: bigint, min: bigint) => DomainError;
    tooLarge: (value: bigint, max: bigint) => DomainError;
    negativeNotAllowed: (value: bigint) => DomainError;
    zeroNotAllowed: (value: bigint) => DomainError;
    divisionByZero: (value: bigint) => DomainError;
    required: () => DomainError;
    custom?: (value: bigint, reason: string) => DomainError;
  };
}

/**
 * Factory function to create bigint-based value objects
 * Provides consistent validation and operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createBigIntVO(config: BigIntVOConfig) {
  // Configuration with defaults
  const ALLOW_NEGATIVE = config.allowNegative ?? true;
  const ALLOW_ZERO = config.allowZero ?? true;
  const REQUIRED = config.required ?? false;
  const MIN_VALUE = config.minValue
    ? typeof config.minValue === 'string'
      ? BigInt(config.minValue)
      : config.minValue
    : undefined;
  const MAX_VALUE = config.maxValue
    ? typeof config.maxValue === 'string'
      ? BigInt(config.maxValue)
      : config.maxValue
    : undefined;

  /**
   * Validate bigint against configuration rules
   */
  const validate = (value: bigint): Result<bigint, DomainError> => {
    // Check negative numbers
    if (!ALLOW_NEGATIVE && value < 0n) {
      return err(config.errors.negativeNotAllowed(value));
    }

    // Check zero
    if (!ALLOW_ZERO && value === 0n) {
      return err(config.errors.zeroNotAllowed(value));
    }

    // Check minimum value (prioritize minValue over min)
    const minVal = MIN_VALUE ?? config.min;
    if (minVal !== undefined && value < minVal) {
      return err(config.errors.tooSmall(value, minVal));
    }

    // Check maximum value (prioritize maxValue over max)
    const maxVal = MAX_VALUE ?? config.max;
    if (maxVal !== undefined && value > maxVal) {
      return err(config.errors.tooLarge(value, maxVal));
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
   * BigInt Value Object implementation
   * Generated dynamically based on configuration
   */
  return class BigIntVO {
    public readonly _value: bigint;

    protected constructor(value: bigint) {
      this._value = value;
    }

    /**
     * Create value object from bigint with validation
     */
    static create(value?: bigint | null): Result<BigIntVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      if (typeof value !== 'bigint') {
        return err(config.errors.type(value));
      }

      const validationResult = validate(value);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new BigIntVO(validationResult.value));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<BigIntVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      if (typeof value === 'bigint') {
        return this.create(value);
      }

      if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
          return err(config.errors.type(value));
        }
        // Check if number is within safe integer bounds to prevent precision loss
        if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
          return err(config.errors.type(value));
        }
        return this.create(BigInt(value));
      }

      if (typeof value === 'string') {
        try {
          // Remove leading/trailing whitespace and check for decimal point
          const trimmed = value.trim();
          if (trimmed === '') {
            return err(config.errors.type(value));
          }
          if (trimmed.includes('.')) {
            return err(config.errors.type(value));
          }
          return this.create(BigInt(trimmed));
        } catch {
          return err(config.errors.type(value));
        }
      }

      return err(config.errors.type(value));
    }

    // ==================== Accessors ====================

    /** Get the bigint value */
    get value(): bigint {
      return this._value;
    }

    /** Check if bigint is zero */
    get isZero(): boolean {
      return this._value === 0n;
    }

    /** Check if bigint is positive */
    get isPositive(): boolean {
      return this._value > 0n;
    }

    /** Check if bigint is negative */
    get isNegative(): boolean {
      return this._value < 0n;
    }

    /** Check if bigint is even */
    get isEven(): boolean {
      return this._value % 2n === 0n;
    }

    /** Check if bigint is odd */
    get isOdd(): boolean {
      return this._value % 2n !== 0n;
    }

    // ==================== Operations ====================

    /**
     * Add another BigIntVO (re-validates result)
     */
    add(other: BigIntVO): Result<BigIntVO, DomainError> {
      const sum = this._value + other._value;
      return BigIntVO.create(sum);
    }

    /**
     * Subtract another BigIntVO (re-validates result)
     */
    subtract(other: BigIntVO): Result<BigIntVO, DomainError> {
      const difference = this._value - other._value;
      return BigIntVO.create(difference);
    }

    /**
     * Multiply by another BigIntVO (re-validates result)
     */
    multiply(other: BigIntVO): Result<BigIntVO, DomainError> {
      const product = this._value * other._value;
      return BigIntVO.create(product);
    }

    /**
     * Divide by another BigIntVO (re-validates result)
     */
    divide(other: BigIntVO): Result<BigIntVO, DomainError> {
      if (other._value === 0n) {
        return err(config.errors.divisionByZero(this._value));
      }
      const quotient = this._value / other._value;
      return BigIntVO.create(quotient);
    }

    /**
     * Modulo operation with another BigIntVO (re-validates result)
     */
    mod(other: BigIntVO): Result<BigIntVO, DomainError> {
      if (other._value === 0n) {
        return err(config.errors.divisionByZero(this._value));
      }
      const remainder = this._value % other._value;
      return BigIntVO.create(remainder);
    }

    /**
     * Power operation (re-validates result)
     */
    pow(exponent: number): Result<BigIntVO, DomainError> {
      if (!Number.isInteger(exponent) || exponent < 0) {
        return err(config.errors.type(exponent));
      }
      const result = this._value ** BigInt(exponent);
      return BigIntVO.create(result);
    }

    /**
     * Get absolute value (re-validates result)
     */
    abs(): Result<BigIntVO, DomainError> {
      const absolute = this._value < 0n ? -this._value : this._value;
      return BigIntVO.create(absolute);
    }

    /**
     * Negate the value (re-validates result)
     */
    negate(): Result<BigIntVO, DomainError> {
      const negated = -this._value;
      return BigIntVO.create(negated);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another BigIntVO
     */
    equals(other: BigIntVO): boolean {
      return this._value === other._value;
    }

    /**
     * Compare with another BigIntVO
     */
    compare(other: BigIntVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Check if greater than another BigIntVO
     */
    greaterThan(other: BigIntVO): boolean {
      return this._value > other._value;
    }

    /**
     * Check if less than another BigIntVO
     */
    lessThan(other: BigIntVO): boolean {
      return this._value < other._value;
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
    toJSON(): { value: string; type: string } {
      return {
        value: this._value.toString(),
        type: config.name,
      };
    }
  };
}
