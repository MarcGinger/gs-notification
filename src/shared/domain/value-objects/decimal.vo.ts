import { Result, ok, err, DomainError } from '../../errors';

/**
 * Interface for defining decimal business rules/refinements
 */
export interface DecimalRefinement {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: number) => boolean;
  /** Create error when test fails */
  createError: (value: number) => DomainError;
}

/**
 * Creates standardized error factory functions for decimal value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., FinanceErrors.INVALID_RATE)
 * @param entityName - Human-readable name for the entity (e.g., 'Interest Rate', 'Tax Rate')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createDecimalVOErrors } from 'src/shared/domain/value-objects/decimal-vo';
 * import { FinanceErrors } from '../errors/finance.errors';
 *
 * export const InterestRate = createDecimalVO({
 *   name: 'InterestRate',
 *   min: 0,
 *   max: 1,
 *   maxDecimalPlaces: 4,
 *   errors: createDecimalVOErrors(FinanceErrors.INVALID_RATE, 'Interest Rate'),
 * });
 * ```
 */
export function createDecimalVOErrors(
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
      detail: `${entityName} must be a finite number, received: ${value}`,
      context: {
        value,
        operation: 'finite_check',
      },
    }),

    tooSmall: (value: number, min: number) => ({
      ...baseError,
      detail: `${entityName} must be at least ${min}, received: ${value}`,
      context: {
        value,
        min,
        operation: 'range_check',
      },
    }),

    tooLarge: (value: number, max: number) => ({
      ...baseError,
      detail: `${entityName} must be at most ${max}, received: ${value}`,
      context: {
        value,
        max,
        operation: 'range_check',
      },
    }),

    tooManyDecimals: (value: number, maxDecimals: number) => ({
      ...baseError,
      detail: `${entityName} must have at most ${maxDecimals} decimal places, received: ${value}`,
      context: {
        value,
        maxDecimals,
        operation: 'decimal_precision_check',
      },
    }),

    tooFewDecimals: (value: number, requiredDecimals: number) => ({
      ...baseError,
      detail: `${entityName} must have exactly ${requiredDecimals} decimal places, received: ${value}`,
      context: {
        value,
        requiredDecimals,
        operation: 'decimal_precision_check',
      },
    }),

    negativeNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} cannot be negative, received: ${value}`,
      context: {
        value,
        operation: 'negative_check',
      },
    }),

    zeroNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} cannot be zero`,
      context: {
        value,
        operation: 'zero_check',
      },
    }),

    divisionByZero: (value: number) => ({
      ...baseError,
      detail: `Cannot divide ${value} by zero`,
      context: {
        value,
        operation: 'division',
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

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: { operation: 'required_check' },
    }),
  };
}

export type DecimalVOInstance = {
  readonly value: number;
  readonly isZero: boolean;
  readonly isPositive: boolean;
  readonly isNegative: boolean;
  readonly isInteger: boolean;
  readonly decimalPlaces: number;
  readonly precision: number;
  add(other: DecimalVOInstance): Result<DecimalVOInstance, DomainError>;
  subtract(other: DecimalVOInstance): Result<DecimalVOInstance, DomainError>;
  multiply(other: DecimalVOInstance): Result<DecimalVOInstance, DomainError>;
  divide(other: DecimalVOInstance): Result<DecimalVOInstance, DomainError>;
  abs(): Result<DecimalVOInstance, DomainError>;
  negate(): Result<DecimalVOInstance, DomainError>;
  round(decimals?: number): Result<DecimalVOInstance, DomainError>;
  ceil(): Result<DecimalVOInstance, DomainError>;
  floor(): Result<DecimalVOInstance, DomainError>;
  truncate(): Result<DecimalVOInstance, DomainError>;
  equals(other: DecimalVOInstance): boolean;
  compare(other: DecimalVOInstance): -1 | 0 | 1;
  greaterThan(other: DecimalVOInstance): boolean;
  lessThan(other: DecimalVOInstance): boolean;
  toString(): string;
  toFixed(decimals?: number): string;
  toJSON(): { value: number; type: string };
};

/**
 * Configuration interface for decimal value objects
 */
export interface DecimalVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
  /** Maximum decimal places allowed */
  maxDecimalPlaces?: number;
  /** Required decimal places (for fixed precision) */
  requiredDecimalPlaces?: number;
  /** Allow negative numbers */
  allowNegative?: boolean;
  /** Allow zero */
  allowZero?: boolean;
  /** Rounding mode for operations */
  roundingMode?: 'round' | 'ceil' | 'floor' | 'trunc';
  /** Whether the value is required */
  required?: boolean;
  /** Minimum value (alternative to min) */
  minValue?: number;
  /** Maximum value (alternative to max) */
  maxValue?: number;
  /** Total number of significant digits (precision) */
  precision?: number;
  /** Number of decimal places (scale) - alternative to maxDecimalPlaces */
  scale?: number;
  /** Rounding mode (alternative to roundingMode) */
  rounding?: string;
  /** Business rule refinements for domain validation */
  refinements?: DecimalRefinement[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: number) => Result<void, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    notFinite: (value: number) => DomainError;
    tooSmall: (value: number, min: number) => DomainError;
    tooLarge: (value: number, max: number) => DomainError;
    tooManyDecimals: (value: number, maxDecimals: number) => DomainError;
    tooFewDecimals: (value: number, requiredDecimals: number) => DomainError;
    negativeNotAllowed: (value: number) => DomainError;
    zeroNotAllowed: (value: number) => DomainError;
    divisionByZero: (value: number) => DomainError;
    custom: (value: number, reason: string) => DomainError;
    required: () => DomainError;
  };
}

/**
 * Factory function to create decimal-based value objects
 * Provides consistent validation and operations with precision control
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createDecimalVO(config: DecimalVOConfig) {
  // Configuration with defaults
  const ALLOW_NEGATIVE = config.allowNegative ?? true;
  const ALLOW_ZERO = config.allowZero ?? true;
  const ROUNDING_MODE =
    config.roundingMode ??
    (config.rounding as 'round' | 'ceil' | 'floor' | 'trunc') ??
    'round';
  const REQUIRED = config.required ?? false;
  const MIN_VALUE = config.minValue ?? config.min;
  const MAX_VALUE = config.maxValue ?? config.max;
  const PRECISION = config.precision;
  const MAX_DECIMAL_PLACES = config.scale ?? config.maxDecimalPlaces;

  /**
   * Get the number of decimal places in a number
   */
  const getDecimalPlaces = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
  };

  /**
   * Apply rounding based on configuration
   */
  const applyRounding = (value: number, decimals?: number): number => {
    if (decimals === undefined) return value;

    const factor = Math.pow(10, decimals);
    const scaled = value * factor;

    switch (ROUNDING_MODE) {
      case 'ceil':
        return Math.ceil(scaled) / factor;
      case 'floor':
        return Math.floor(scaled) / factor;
      case 'trunc':
        return Math.trunc(scaled) / factor;
      case 'round':
      default:
        return Math.round(scaled) / factor;
    }
  };

  /**
   * Validate decimal against configuration rules
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

    // Check decimal places (prioritize scale over maxDecimalPlaces)
    const maxDecimalPlaces = MAX_DECIMAL_PLACES ?? config.maxDecimalPlaces;
    if (maxDecimalPlaces !== undefined) {
      const decimalPlaces = getDecimalPlaces(value);
      if (decimalPlaces > maxDecimalPlaces) {
        return err(config.errors.tooManyDecimals(value, maxDecimalPlaces));
      }
    }

    // Check precision (total significant digits)
    if (PRECISION !== undefined) {
      const valueStr = value.toString().replace(/[.-]/g, '');
      const totalDigits = valueStr.length;
      if (totalDigits > PRECISION) {
        return err(config.errors.tooManyDecimals(value, PRECISION));
      }
    }

    // Check required decimal places
    if (config.requiredDecimalPlaces !== undefined) {
      const decimalPlaces = getDecimalPlaces(value);
      if (decimalPlaces !== config.requiredDecimalPlaces) {
        return err(
          config.errors.tooFewDecimals(value, config.requiredDecimalPlaces),
        );
      }
    }

    // Check minimum value (prioritize minValue over min)
    const minValue = MIN_VALUE ?? config.min;
    if (minValue !== undefined && value < minValue) {
      return err(config.errors.tooSmall(value, minValue));
    }

    // Check maximum value (prioritize maxValue over max)
    const maxValue = MAX_VALUE ?? config.max;
    if (maxValue !== undefined && value > maxValue) {
      return err(config.errors.tooLarge(value, maxValue));
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
   * Decimal Value Object implementation
   * Generated dynamically based on configuration
   */
  return class DecimalVO {
    public readonly _value: number;

    protected constructor(value: number) {
      this._value = value;
    }

    /**
     * Create value object from number with validation
     */
    static create(value?: number | null): Result<DecimalVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      if (typeof value !== 'number') {
        return err(config.errors.type(value));
      }

      const validationResult = validate(value);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new DecimalVO(validationResult.value));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<DecimalVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      if (typeof value === 'number') {
        return this.create(value);
      }

      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return this.create(parsed);
        }
      }

      if (typeof value === 'bigint') {
        return this.create(Number(value));
      }

      return err(config.errors.type(value));
    }

    // ==================== Accessors ====================

    /** Get the decimal value */
    get value(): number {
      return this._value;
    }

    /** Check if decimal is zero */
    get isZero(): boolean {
      return this._value === 0;
    }

    /** Check if decimal is positive */
    get isPositive(): boolean {
      return this._value > 0;
    }

    /** Check if decimal is negative */
    get isNegative(): boolean {
      return this._value < 0;
    }

    /** Check if decimal is an integer */
    get isInteger(): boolean {
      return Number.isInteger(this._value);
    }

    /** Get the number of decimal places */
    get decimalPlaces(): number {
      return getDecimalPlaces(this._value);
    }

    /** Get the precision (total significant digits) */
    get precision(): number {
      return this._value.toString().replace(/^-/, '').replace(/\./, '').length;
    }

    // ==================== Operations ====================

    /**
     * Add another DecimalVO (re-validates result)
     */
    add(other: DecimalVO): Result<DecimalVO, DomainError> {
      const sum = this._value + other._value;
      return DecimalVO.create(sum);
    }

    /**
     * Subtract another DecimalVO (re-validates result)
     */
    subtract(other: DecimalVO): Result<DecimalVO, DomainError> {
      const difference = this._value - other._value;
      return DecimalVO.create(difference);
    }

    /**
     * Multiply by another DecimalVO (re-validates result)
     */
    multiply(other: DecimalVO): Result<DecimalVO, DomainError> {
      const product = this._value * other._value;
      return DecimalVO.create(product);
    }

    /**
     * Divide by another DecimalVO (re-validates result)
     */
    divide(other: DecimalVO): Result<DecimalVO, DomainError> {
      if (other._value === 0) {
        return err(config.errors.divisionByZero(this._value));
      }
      const quotient = this._value / other._value;
      return DecimalVO.create(quotient);
    }

    /**
     * Get absolute value (re-validates result)
     */
    abs(): Result<DecimalVO, DomainError> {
      const absolute = Math.abs(this._value);
      return DecimalVO.create(absolute);
    }

    /**
     * Negate the value (re-validates result)
     */
    negate(): Result<DecimalVO, DomainError> {
      const negated = -this._value;
      return DecimalVO.create(negated);
    }

    /**
     * Round to specified decimal places (re-validates result)
     */
    round(decimals?: number): Result<DecimalVO, DomainError> {
      const rounded = applyRounding(this._value, decimals);
      return DecimalVO.create(rounded);
    }

    /**
     * Round up to specified decimal places (re-validates result)
     */
    ceil(): Result<DecimalVO, DomainError> {
      const ceiled = Math.ceil(this._value);
      return DecimalVO.create(ceiled);
    }

    /**
     * Round down to specified decimal places (re-validates result)
     */
    floor(): Result<DecimalVO, DomainError> {
      const floored = Math.floor(this._value);
      return DecimalVO.create(floored);
    }

    /**
     * Truncate decimal places (re-validates result)
     */
    truncate(): Result<DecimalVO, DomainError> {
      const truncated = Math.trunc(this._value);
      return DecimalVO.create(truncated);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another DecimalVO
     */
    equals(other: DecimalVO): boolean {
      return this._value === other._value;
    }

    /**
     * Compare with another DecimalVO
     */
    compare(other: DecimalVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Check if greater than another DecimalVO
     */
    greaterThan(other: DecimalVO): boolean {
      return this._value > other._value;
    }

    /**
     * Check if less than another DecimalVO
     */
    lessThan(other: DecimalVO): boolean {
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
     * Convert to fixed decimal string
     */
    toFixed(decimals?: number): string {
      return this._value.toFixed(decimals);
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
