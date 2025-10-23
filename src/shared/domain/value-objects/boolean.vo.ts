import { Result, ok, err, DomainError } from '../../errors';

/**
 * Creates standardized error factory functions for boolean value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity (e.g., 'Active Status', 'Enabled Flag')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createBooleanVOErrors } from 'src/shared/domain/value-objects/boolean-vo';
 * import { ChannelErrors } from '../errors/channel.errors';
 *
 * export const ChannelActive = createBooleanVO({
 *   name: 'ChannelActive',
 *   errors: createBooleanVOErrors(ChannelErrors.INVALID_ACTIVE, 'Active Status'),
 * });
 * ```
 */
export function createBooleanVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a boolean, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'boolean',
        received: typeof value,
      },
    }),

    invalid: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} has invalid value: ${String(value)}`,
      context: { value, operation: 'invalid_value_check' },
    }),

    custom: (value: boolean, reason: string) => ({
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

export type BooleanVOInstance = {
  readonly value: boolean;
  readonly isTrue: boolean;
  readonly isFalse: boolean;
  and(other: BooleanVOInstance): Result<BooleanVOInstance, DomainError>;
  or(other: BooleanVOInstance): Result<BooleanVOInstance, DomainError>;
  not(): Result<BooleanVOInstance, DomainError>;
  xor(other: BooleanVOInstance): Result<BooleanVOInstance, DomainError>;
  implies(other: BooleanVOInstance): Result<BooleanVOInstance, DomainError>;
  equals(other: BooleanVOInstance): boolean;
  compare(other: BooleanVOInstance): -1 | 0 | 1;
  toString(): string;
  toJSON(): { value: boolean; type: string };
};

/**
 * Refinement interface for custom boolean business rules
 */
export interface BooleanRefinement {
  /** Unique name for the refinement rule */
  name: string;
  /** Test function that returns true if value passes validation */
  test: (value: boolean) => boolean;
  /** Error factory function called when test fails */
  createError: (value: boolean) => DomainError;
}

/**
 * Configuration interface for boolean value objects
 */
export interface BooleanVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Default value when parsing fails */
  defaultValue?: boolean;
  /** Allow undefined/null values to be treated as false */
  treatNullAsFalse?: boolean;
  /** Whether the value is required */
  required?: boolean;
  /** Business rule refinements for additional validation */
  refinements?: BooleanRefinement[];
  /** Custom validation function for business rules */
  customValidation?: (value: boolean) => Result<boolean, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    invalid: (value: unknown) => DomainError;
    required: () => DomainError;
    custom?: (value: boolean, reason: string) => DomainError;
  };
}

/**
 * Factory function to create boolean-based value objects
 * Provides consistent validation and boolean operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createBooleanVO(config: BooleanVOConfig) {
  // Configuration with defaults
  const DEFAULT_VALUE = config.defaultValue ?? false;
  const TREAT_NULL_AS_FALSE = config.treatNullAsFalse ?? true;
  const REQUIRED = config.required ?? false;

  /**
   * Validate and normalize boolean value
   */
  const validate = (value: boolean): Result<boolean, DomainError> => {
    if (typeof value !== 'boolean') {
      return err(config.errors.type(value));
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
   * Boolean Value Object implementation
   * Generated dynamically based on configuration
   */
  return class BooleanVO {
    public readonly _value: boolean;

    protected constructor(value: boolean) {
      this._value = value;
    }

    /**
     * Create value object from boolean with validation
     */
    /**
     * Create value object from boolean with validation
     */
    static create(value?: boolean | null): Result<BooleanVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      if (typeof value !== 'boolean') {
        return err(config.errors.type(value));
      }

      const validationResult = validate(value);

      if (validationResult.ok) {
        return ok(new BooleanVO(validationResult.value));
      } else {
        return err(
          (validationResult as { ok: false; error: DomainError }).error,
        );
      }
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<BooleanVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      if (typeof value === 'boolean') {
        return this.create(value);
      }

      if (typeof value === 'number') {
        if (value === 0) return this.create(false);
        if (value === 1) return this.create(true);
        return err(config.errors.invalid(value));
      }

      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase().trim();
        if (
          lowerValue === 'true' ||
          lowerValue === '1' ||
          lowerValue === 'yes' ||
          lowerValue === 'on'
        ) {
          return this.create(true);
        }
        if (
          lowerValue === 'false' ||
          lowerValue === '0' ||
          lowerValue === 'no' ||
          lowerValue === 'off'
        ) {
          return this.create(false);
        }
        return err(config.errors.invalid(value));
      }

      if (value === null || value === undefined) {
        if (TREAT_NULL_AS_FALSE) {
          return this.create(DEFAULT_VALUE);
        }
        return err(config.errors.invalid(value));
      }

      return err(config.errors.type(value));
    }

    // ==================== Accessors ====================

    /** Get the boolean value */
    get value(): boolean {
      return this._value;
    }

    /** Check if boolean is true */
    get isTrue(): boolean {
      return this._value === true;
    }

    /** Check if boolean is false */
    get isFalse(): boolean {
      return this._value === false;
    }

    // ==================== Operations ====================

    /**
     * Logical AND with another BooleanVO
     */
    and(other: BooleanVO): Result<BooleanVO, DomainError> {
      const result = this._value && other._value;
      return BooleanVO.create(result);
    }

    /**
     * Logical OR with another BooleanVO
     */
    or(other: BooleanVO): Result<BooleanVO, DomainError> {
      const result = this._value || other._value;
      return BooleanVO.create(result);
    }

    /**
     * Logical NOT (negation)
     */
    not(): Result<BooleanVO, DomainError> {
      const result = !this._value;
      return BooleanVO.create(result);
    }

    /**
     * Logical XOR with another BooleanVO
     */
    xor(other: BooleanVO): Result<BooleanVO, DomainError> {
      const result = this._value !== other._value;
      return BooleanVO.create(result);
    }

    /**
     * Logical implication (if this then other)
     */
    implies(other: BooleanVO): Result<BooleanVO, DomainError> {
      const result = !this._value || other._value;
      return BooleanVO.create(result);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another BooleanVO
     */
    equals(other: BooleanVO): boolean {
      return this._value === other._value;
    }

    /**
     * Compare with another BooleanVO (false < true)
     */
    compare(other: BooleanVO): -1 | 0 | 1 {
      if (this._value === other._value) return 0;
      if (!this._value && other._value) return -1;
      return 1;
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
    toJSON(): { value: boolean; type: string } {
      return {
        value: this._value,
        type: config.name,
      };
    }
  };
}
