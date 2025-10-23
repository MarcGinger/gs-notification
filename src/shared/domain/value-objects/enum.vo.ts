import { Result, ok, err, DomainError } from '../../errors';

/**
 * Configuration for state machine transitions
 */
export interface StateTransitions<T extends string | number> {
  [key: string]: readonly T[];
}

/**
 * Creates state machine transition helpers for enum values
 * Provides consistent transition validation across all stateful enums
 */
export function createStateTransitions<T extends string | number>(
  transitions: StateTransitions<T>,
) {
  const helpers = {
    /**
     * Check if transition from one state to another is valid
     */
    canTransition(from: T, to: T): boolean {
      return transitions[from as string]?.includes(to) ?? false;
    },

    /**
     * Get all valid next states from current state
     */
    getValidTransitions(from: T): readonly T[] {
      return transitions[from as string] ?? [];
    },

    /**
     * Check if state is terminal (no outgoing transitions)
     */
    isTerminal(state: T): boolean {
      return helpers.getValidTransitions(state).length === 0;
    },

    /**
     * Get all states that can transition to target state
     */
    getSourceStates(target: T): T[] {
      return Object.entries(transitions)
        .filter(([, targets]) => targets.includes(target))
        .map(([source]) => source as T);
    },

    /**
     * Validate transition and return error if invalid
     */
    validateTransition(
      from: T,
      to: T,
      errorFactory: (from: T, to: T) => DomainError,
    ): Result<void, DomainError> {
      if (helpers.canTransition(from, to)) {
        return ok(undefined);
      }
      return err(errorFactory(from, to));
    },
  };

  return helpers;
}

/**
 * Creates type guard functions for enum values
 * Provides consistent runtime type checking across all enums
 */
export function createEnumTypeGuards<T extends string | number>(
  values: readonly T[],
  entityName: string,
  errorFactory: (value: unknown, validValues: readonly T[]) => DomainError,
) {
  const guards = {
    /**
     * Type guard to check if value is valid enum value
     */
    isValid(value: unknown): value is T {
      return typeof value === 'string' && values.includes(value as T);
    },

    /**
     * Assert that value is valid enum value (returns Result instead of throwing)
     */
    validate(value: unknown): Result<T, DomainError> {
      if (guards.isValid(value)) {
        return ok(value);
      }
      return err(errorFactory(value, values));
    },

    /**
     * Assert that value is valid enum value (throws DomainError if invalid)
     * Use sparingly - prefer validate() method for better error handling
     */
    assert(value: unknown): asserts value is T {
      const result = guards.validate(value);
      if (!result.ok) {
        const error = new Error(result.error.detail);
        error.name = result.error.code;
        Object.assign(error, { domainError: result.error });
        throw error;
      }
    },
  };

  return guards;
}

/**
 * Creates display name helpers for enum values
 * Provides consistent display name management across all enums
 */
export function createDisplayNameHelper<T extends string | number>(
  displayNames: Record<string, string>,
) {
  return {
    /**
     * Get human-readable display name for enum value
     */
    getDisplayName(value: T): string {
      return displayNames[value as string] ?? String(value);
    },

    /**
     * Get all display names as key-value pairs
     */
    getAllDisplayNames(): Record<string, string> {
      return { ...displayNames };
    },
  };
}

/**
 * Interface for defining enum business rules/refinements
 */
export interface EnumRefinement<T extends string | number> {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: T) => boolean;
  /** Create error when test fails */
  createError: (value: T) => DomainError;
}

/**
 * Creates standardized error factory functions for enum value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., ProductErrors.INVALID_STATUS)
 * @param entityName - Human-readable name for the entity (e.g., 'Status', 'Product Type')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createEnumVOErrors } from 'src/shared/domain/value-objects/enum-vo';
 * import { ProductErrors } from '../errors/product.errors';
 *
 * export const ProductStatus = createEnumVO({
 *   name: 'ProductStatus',
 *   values: ['active', 'inactive', 'pending'] as const,
 *   errors: createEnumVOErrors(ProductErrors.INVALID_STATUS, 'Status'),
 * });
 * ```
 */
export function createEnumVOErrors<T extends string | number>(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a valid enum value, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'string | number',
        received: typeof value,
      },
    }),

    invalidValue: (value: T, validValues: readonly T[]) => ({
      ...baseError,
      detail: `${entityName} must be one of: ${validValues.join(', ')}, received: ${value}`,
      context: {
        value,
        validValues: [...validValues],
        operation: 'enum_validation',
      },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: {
        operation: 'required_validation',
      },
    }),

    custom: (value: unknown, reason: string) => ({
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
 * Creates enhanced error factory functions with more descriptive enum validation errors
 * for specific business domains that need detailed validation messaging.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity
 * @param validValuesDescription - Human-readable description of valid values
 * @returns Object with enhanced error factory functions
 *
 * @example
 * ```typescript
 * export const ProductCategory = createEnumVO({
 *   name: 'ProductCategory',
 *   values: ['SAVINGS', 'CHECKING', 'CREDIT'] as const,
 *   errors: createEnhancedEnumVOErrors(
 *     ProductErrors.INVALID_CATEGORY,
 *     'Product Category',
 *     'banking product categories (SAVINGS, CHECKING, or CREDIT)'
 *   ),
 * });
 * ```
 */
export function createEnhancedEnumVOErrors<T extends string | number>(
  baseError: DomainError,
  entityName: string,
  validValuesDescription?: string,
) {
  const standardErrors = createEnumVOErrors(baseError, entityName);

  return {
    ...standardErrors,
    invalidValue: (value: T, validValues: readonly T[]) => ({
      ...baseError,
      detail: validValuesDescription
        ? `${entityName} must be ${validValuesDescription}`
        : `${entityName} must be one of: ${validValues.join(', ')}, received: ${value}`,
      context: {
        value,
        validValues: [...validValues],
        operation: 'enum_validation',
        ...(validValuesDescription && {
          expectedDescription: validValuesDescription,
        }),
      },
    }),
  };
}

export type EnumVOInstance<T extends string | number> = {
  readonly value: T;
  readonly possibleValues: readonly T[];
  equals(other: EnumVOInstance<T>): boolean;
  compare(other: EnumVOInstance<T>): -1 | 0 | 1;
  isOneOf(...values: T[]): boolean;
  toString(): string;
  toJSON(): { value: T; type: string; possibleValues: readonly T[] };
};

/**
 * Configuration interface for enum value objects
 */
export interface EnumVOConfig<T extends string | number> {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Array of valid enum values */
  values: readonly T[];
  /** Case sensitivity for string enums */
  caseSensitive?: boolean;
  /** Business rule refinements for domain validation */
  refinements?: EnumRefinement<T>[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: T) => Result<void, DomainError>;
  /** Whether the value is required */
  required?: boolean;
  /** Transform function name for value conversion */
  transform?: string;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    invalidValue: (value: T, validValues: readonly T[]) => DomainError;
    required?: () => DomainError;
  };
}

/**
 * Factory function to create enum-based value objects
 * Provides consistent validation for predefined sets of values
 *
 * @param config Configuration object defining valid values and error factories
 * @returns Value object class with validation and operations
 */
export function createEnumVO<T extends string | number>(
  config: EnumVOConfig<T>,
) {
  // Configuration with defaults
  const CASE_SENSITIVE = config.caseSensitive ?? true;

  /**
   * Normalize value for comparison (case-insensitive if configured)
   */
  const normalize = (value: T): T => {
    if (!CASE_SENSITIVE && typeof value === 'string') {
      return value.toLowerCase() as T;
    }
    return value;
  };

  /**
   * Get normalized valid values for comparison
   */
  const normalizedValidValues = config.values.map(normalize);

  /**
   * Validate value against allowed enum values
   */
  const validate = (value: T): Result<T, DomainError> => {
    const normalizedValue = normalize(value);
    const isValid = normalizedValidValues.includes(normalizedValue);

    if (!isValid) {
      return err(config.errors.invalidValue(value, config.values));
    }

    // Get the actual value to use (for case-insensitive matching)
    let actualValue = value;
    if (!CASE_SENSITIVE && typeof value === 'string') {
      const matchingValue = config.values.find(
        (v) => normalize(v) === normalizedValue,
      );
      actualValue = matchingValue || value;
    }

    // Process refinements (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(actualValue)) {
          return err(refinement.createError(actualValue));
        }
      }
    }

    // Process custom validation
    if (config.customValidation) {
      const customResult = config.customValidation(actualValue);
      if (!customResult.ok) {
        return err(customResult.error);
      }
    }

    return ok(actualValue);
  };

  /**
   * Enum Value Object implementation
   * Generated dynamically based on configuration
   */
  return class EnumVO {
    public readonly _value: T;

    protected constructor(value: T) {
      this._value = value;
    }

    /**
     * Create value object from enum value with validation
     */
    static create(value?: T | null): Result<EnumVO, DomainError> {
      // Check if value is required but not provided
      if (config.required && (value === undefined || value === null)) {
        return err(config.errors.required?.() || config.errors.type(value));
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      // Apply transform if configured
      let transformedValue = value;
      if (config.transform) {
        switch (config.transform) {
          case 'uppercase':
            if (typeof value === 'string') {
              transformedValue = value.toUpperCase() as T;
            }
            break;
          case 'lowercase':
            if (typeof value === 'string') {
              transformedValue = value.toLowerCase() as T;
            }
            break;
          case 'trim':
            if (typeof value === 'string') {
              transformedValue = value.trim() as T;
            }
            break;
        }
      }

      if (
        typeof transformedValue !== 'string' &&
        typeof transformedValue !== 'number'
      ) {
        return err(config.errors.type(transformedValue));
      }

      const validationResult = validate(transformedValue);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new EnumVO(validationResult.value));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<EnumVO, DomainError> {
      if (typeof value === 'string' || typeof value === 'number') {
        return this.create(value as T);
      }

      return err(config.errors.type(value));
    }

    // ==================== Static Helpers ====================

    /**
     * Get all valid enum values
     */
    static get values(): readonly T[] {
      return config.values;
    }

    /**
     * Check if a value is valid for this enum
     */
    static isValid(value: unknown): value is T {
      if (typeof value !== 'string' && typeof value !== 'number') {
        return false;
      }
      const normalized = normalize(value as T);
      return normalizedValidValues.includes(normalized);
    }

    // ==================== Accessors ====================

    /** Get the enum value */
    get value(): T {
      return this._value;
    }

    /** Get all possible values for this enum */
    get possibleValues(): readonly T[] {
      return config.values;
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another EnumVO
     */
    equals(other: EnumVO): boolean {
      if (
        !CASE_SENSITIVE &&
        typeof this._value === 'string' &&
        typeof other._value === 'string'
      ) {
        return normalize(this._value) === normalize(other._value);
      }
      return this._value === other._value;
    }

    /**
     * Compare with another EnumVO (lexicographical comparison)
     */
    compare(other: EnumVO): -1 | 0 | 1 {
      const thisStr = String(this._value);
      const otherStr = String(other._value);
      if (thisStr < otherStr) return -1;
      if (thisStr > otherStr) return 1;
      return 0;
    }

    /**
     * Check if this enum value matches any of the provided values
     */
    isOneOf(...values: T[]): boolean {
      return values.some((value) => {
        if (
          !CASE_SENSITIVE &&
          typeof this._value === 'string' &&
          typeof value === 'string'
        ) {
          return normalize(this._value) === normalize(value);
        }
        return this._value === value;
      });
    }

    // ==================== Serialization ====================

    /**
     * Convert to string representation
     */
    toString(): string {
      return String(this._value);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: T; type: string; possibleValues: readonly T[] } {
      return {
        value: this._value,
        type: config.name,
        possibleValues: config.values,
      };
    }
  };
}
