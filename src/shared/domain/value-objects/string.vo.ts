import { Result, ok, err, DomainError } from '../../errors';

/**
 * Creates standardized error factory functions for string value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., ChannelErrors.INVALID_DESCRIPTION)
 * @param entityName - Human-readable name for the entity (e.g., 'Description', 'Channel Code')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createStringVOErrors } from 'src/shared/domain/value-objects/string-vo';
 * import { ChannelErrors } from '../errors/channel.errors';
 *
 * export const ChannelDescription = createStringVO({
 *   name: 'ChannelDescription',
 *   trim: true,
 *   allowEmpty: true,
 *   maxLength: 500,
 *   errors: createStringVOErrors(ChannelErrors.INVALID_DESCRIPTION, 'Description'),
 * });
 * ```
 */
export function createStringVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a string, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'string',
        received: typeof value,
      },
    }),

    empty: (value: string) => ({
      ...baseError,
      detail: `${entityName} cannot be empty`,
      context: { value, operation: 'empty_check' },
    }),

    tooShort: (value: string, min: number) => ({
      ...baseError,
      detail: `${entityName} must be at least ${min} character${min > 1 ? 's' : ''}`,
      context: { value, minLength: min, operation: 'length_check' },
    }),

    tooLong: (value: string, max: number) => ({
      ...baseError,
      detail: `${entityName} cannot exceed ${max} characters`,
      context: { value, maxLength: max, operation: 'length_check' },
    }),

    pattern: (value: string, pattern: RegExp) => ({
      ...baseError,
      detail: `${entityName} format is invalid`,
      context: {
        value,
        pattern: pattern.toString(),
        operation: 'pattern_check',
      },
    }),

    custom: (value: string, reason: string) => ({
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

/**
 * Creates enhanced error factory functions with more descriptive pattern errors
 * for specific business domains that need detailed validation messaging.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity
 * @param patternDescription - Human-readable description of the expected format
 * @returns Object with enhanced error factory functions
 *
 * @example
 * ```typescript
 * export const ChannelCode = createStringVO({
 *   name: 'ChannelCode',
 *   pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
 *   errors: createEnhancedStringVOErrors(
 *     ChannelErrors.INVALID_CODE,
 *     'Channel Code',
 *     'alphanumeric characters, underscores, and hyphens (must start with alphanumeric)'
 *   ),
 * });
 * ```
 */
export function createEnhancedStringVOErrors(
  baseError: DomainError,
  entityName: string,
  patternDescription?: string,
) {
  const standardErrors = createStringVOErrors(baseError, entityName);

  return {
    ...standardErrors,
    pattern: (value: string, pattern: RegExp) => ({
      ...baseError,
      detail: patternDescription
        ? `${entityName} must contain only ${patternDescription}`
        : `${entityName} format is invalid`,
      context: {
        value,
        pattern: pattern.toString(),
        operation: 'pattern_check',
        ...(patternDescription && { expectedFormat: patternDescription }),
      },
    }),
  };
}

export type StringVOInstance = {
  readonly value: string;
  readonly length: number;
  readonly isEmpty: boolean;
  concat(other: StringVOInstance): Result<StringVOInstance, DomainError>;
  append(suffix: string): Result<StringVOInstance, DomainError>;
  prepend(prefix: string): Result<StringVOInstance, DomainError>;
  slice(start?: number, end?: number): Result<StringVOInstance, DomainError>;
  replace(
    search: string | RegExp,
    replacement: string,
  ): Result<StringVOInstance, DomainError>;
  equals(other: StringVOInstance): boolean;
  compare(other: StringVOInstance): -1 | 0 | 1;
  toString(): string;
  toJSON(): { value: string; type: string };
};

/**
 * Case transformation options for string normalization
 */
export type StringCase = 'none' | 'lower' | 'upper';

/**
 * Business rule refinement for additional validation
 */
export interface StringRefinement {
  /** Name of the refinement rule (for debugging and error context) */
  name: string;
  /** Test function that returns true if the value passes the rule */
  test: (value: string) => boolean;
  /** Error factory function called when the test fails */
  createError: (value: string) => DomainError;
}

/**
 * Configuration interface for string value objects
 */
export interface StringVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Remove leading/trailing whitespace before validation */
  trim?: boolean;
  /** Transform case during normalization */
  caseTransform?: StringCase;
  /** Allow empty strings */
  allowEmpty?: boolean;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Regex pattern validation */
  pattern?: RegExp;
  /** Whether the value is required */
  required?: boolean;
  /** Business rule refinements for additional validation */
  refinements?: StringRefinement[];
  /** Custom validation function for business rules */
  customValidation?: (value: string) => Result<string, DomainError>;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    empty: (value: string) => DomainError;
    tooShort: (value: string, min: number) => DomainError;
    tooLong: (value: string, max: number) => DomainError;
    pattern: (value: string, pattern: RegExp) => DomainError;
    required: () => DomainError;
    custom?: (value: string, reason: string) => DomainError;
  };
}

/**
 * Factory function to create string-based value objects
 * Provides consistent validation, normalization, and operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createStringVO(config: StringVOConfig) {
  // Configuration with defaults
  const TRIM = config.trim ?? true;
  const CASE_TRANSFORM = config.caseTransform ?? 'none';
  const ALLOW_EMPTY = config.allowEmpty ?? false;
  const REQUIRED = config.required ?? false;

  /**
   * Apply normalization rules (trim + case transform)
   */
  const normalize = (input: string): string => {
    let normalized = TRIM ? input.trim() : input;

    switch (CASE_TRANSFORM) {
      case 'lower':
        normalized = normalized.toLowerCase();
        break;
      case 'upper':
        normalized = normalized.toUpperCase();
        break;
      default:
        // 'none' - no transformation
        break;
    }

    return normalized;
  };

  /**
   * Validate normalized string against configuration rules
   */
  const validate = (value: string): Result<string, DomainError> => {
    // Empty check
    if (!ALLOW_EMPTY && value.length === 0) {
      return err(config.errors.empty(value));
    }

    // Minimum length check
    if (
      typeof config.minLength === 'number' &&
      value.length < config.minLength
    ) {
      return err(config.errors.tooShort(value, config.minLength));
    }

    // Maximum length check
    if (
      typeof config.maxLength === 'number' &&
      value.length > config.maxLength
    ) {
      return err(config.errors.tooLong(value, config.maxLength));
    }

    // Pattern validation
    if (config.pattern && !config.pattern.test(value)) {
      return err(config.errors.pattern(value, config.pattern));
    }

    // Refinements validation (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(value)) {
          return err(refinement.createError(value));
        }
      }
    }

    // Custom validation (for business rules like profanity checking)
    if (config.customValidation) {
      const customResult = config.customValidation(value);
      if (!customResult.ok) {
        return customResult;
      }
    }

    return ok(value);
  };

  /**
   * String Value Object implementation
   * Generated dynamically based on configuration
   */
  return class StringVO {
    public readonly _value: string;

    protected constructor(value: string) {
      this._value = value;
    }

    /**
     * Create value object from string with validation
     */
    static create(value?: string | null): Result<StringVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null || value === '')) {
        return err(config.errors.required());
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      if (typeof value !== 'string') {
        return err(config.errors.type(value));
      }

      const normalized = normalize(value);
      const validationResult: Result<
        string,
        DomainError<string, any>
      > = validate(normalized);

      if (validationResult.ok) {
        return ok(new StringVO(validationResult.value));
      } else {
        return err(
          (validationResult as { ok: false; error: DomainError }).error,
        );
      }
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<StringVO, DomainError> {
      // Check if value is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      // Handle VO instances - if it's already a VO with the same underlying value type
      if (
        value &&
        typeof value === 'object' &&
        'value' in value &&
        '_value' in value
      ) {
        const voCandidate = value as { _value: unknown };
        if (typeof voCandidate._value === 'string') {
          // It's likely already a StringVO instance, return it as-is
          // This avoids unnecessary re-validation of already validated VOs
          return ok(value as StringVO);
        }
      }

      if (typeof value === 'string') {
        return this.create(value);
      }

      // Allow coercion from number and boolean
      if (typeof value === 'number' && Number.isFinite(value)) {
        return this.create(String(value));
      }

      if (typeof value === 'boolean') {
        return this.create(value ? 'true' : 'false');
      }

      return err(config.errors.type(value));
    }

    // ==================== Accessors ====================

    /** Get the string value */
    get value(): string {
      return this._value;
    }

    /** Get string length */
    get length(): number {
      return this._value.length;
    }

    /** Check if string is empty */
    get isEmpty(): boolean {
      return this._value.length === 0;
    }

    // ==================== Operations ====================

    /**
     * Concatenate with another StringVO (re-validates result)
     */
    concat(other: StringVO): Result<StringVO, DomainError> {
      const combined = this._value + other._value;
      return StringVO.create(combined);
    }

    /**
     * Append a string suffix (re-validates result)
     */
    append(suffix: string): Result<StringVO, DomainError> {
      if (typeof suffix !== 'string') {
        return err(config.errors.type(suffix));
      }
      return StringVO.create(this._value + suffix);
    }

    /**
     * Prepend a string prefix (re-validates result)
     */
    prepend(prefix: string): Result<StringVO, DomainError> {
      if (typeof prefix !== 'string') {
        return err(config.errors.type(prefix));
      }
      return StringVO.create(prefix + this._value);
    }

    /**
     * Slice string (re-validates result)
     */
    slice(start?: number, end?: number): Result<StringVO, DomainError> {
      const sliced = this._value.slice(start, end);
      return StringVO.create(sliced);
    }

    /**
     * Replace string content (re-validates result)
     */
    replace(
      search: string | RegExp,
      replacement: string,
    ): Result<StringVO, DomainError> {
      if (typeof replacement !== 'string') {
        return err(config.errors.type(replacement));
      }
      const replaced = this._value.replace(search, replacement);
      return StringVO.create(replaced);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another StringVO
     */
    equals(other: StringVO): boolean {
      return this._value === other._value;
    }

    /**
     * Compare with another StringVO (lexicographic)
     */
    compare(other: StringVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    // ==================== Serialization ====================

    /**
     * Convert to string representation
     */
    toString(): string {
      return this._value;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: string; type: string } {
      return {
        value: this._value,
        type: config.name,
      };
    }
  };
}
