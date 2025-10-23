import { Result, ok, err, DomainError } from '../../errors';

/**
 * Creates standardized error factory functions for record value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., ConfigErrors.INVALID_METADATA)
 * @param entityName - Human-readable name for the entity (e.g., 'Metadata', 'Configuration')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createRecordVOErrors } from 'src/shared/domain/value-objects/record-vo';
 * import { ConfigErrors } from '../errors/config.errors';
 *
 * export const ConfigurationMetadata = createRecordVO({
 *   name: 'ConfigurationMetadata',
 *   allowEmpty: true,
 *   maxKeys: 50,
 *   errors: createRecordVOErrors(ConfigErrors.INVALID_METADATA, 'Metadata'),
 * });
 * ```
 */
export function createRecordVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be an object, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'object',
        received: typeof value,
      },
    }),

    empty: (value: Record<string, unknown>) => ({
      ...baseError,
      detail: `${entityName} cannot be empty`,
      context: { value, operation: 'empty_check' },
    }),

    tooFewKeys: (value: Record<string, unknown>, min: number) => ({
      ...baseError,
      detail: `${entityName} must have at least ${min} key${min > 1 ? 's' : ''}`,
      context: {
        value,
        minKeys: min,
        actualKeys: Object.keys(value).length,
        operation: 'key_count_check',
      },
    }),

    tooManyKeys: (value: Record<string, unknown>, max: number) => ({
      ...baseError,
      detail: `${entityName} cannot exceed ${max} keys`,
      context: {
        value,
        maxKeys: max,
        actualKeys: Object.keys(value).length,
        operation: 'key_count_check',
      },
    }),

    invalidKey: (
      value: Record<string, unknown>,
      key: string,
      pattern: RegExp,
    ) => ({
      ...baseError,
      detail: `${entityName} key "${key}" format is invalid`,
      context: {
        value,
        invalidKey: key,
        pattern: pattern.toString(),
        operation: 'key_pattern_check',
      },
    }),

    forbiddenKey: (value: Record<string, unknown>, key: string) => ({
      ...baseError,
      detail: `${entityName} key "${key}" is not allowed`,
      context: {
        value,
        forbiddenKey: key,
        operation: 'forbidden_key_check',
      },
    }),

    requiredKey: (value: Record<string, unknown>, key: string) => ({
      ...baseError,
      detail: `${entityName} must contain required key "${key}"`,
      context: {
        value,
        requiredKey: key,
        operation: 'required_key_check',
      },
    }),

    custom: (value: Record<string, unknown>, reason: string) => ({
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
      context: {
        operation: 'required_validation',
      },
    }),
  };
}

/**
 * Creates enhanced error factory functions with more descriptive key validation errors
 * for specific business domains that need detailed validation messaging.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity
 * @param keyPatternDescription - Human-readable description of the expected key format
 * @returns Object with enhanced error factory functions
 *
 * @example
 * ```typescript
 * export const ApiHeaders = createRecordVO({
 *   name: 'ApiHeaders',
 *   keyPattern: /^[a-zA-Z][a-zA-Z0-9-]*$/,
 *   errors: createEnhancedRecordVOErrors(
 *     ApiErrors.INVALID_HEADERS,
 *     'API Headers',
 *     'alphanumeric characters and hyphens (must start with letter)'
 *   ),
 * });
 * ```
 */
export function createEnhancedRecordVOErrors(
  baseError: DomainError,
  entityName: string,
  keyPatternDescription?: string,
) {
  const standardErrors = createRecordVOErrors(baseError, entityName);

  return {
    ...standardErrors,
    invalidKey: (
      value: Record<string, unknown>,
      key: string,
      pattern: RegExp,
    ) => ({
      ...baseError,
      detail: keyPatternDescription
        ? `${entityName} key "${key}" must contain only ${keyPatternDescription}`
        : `${entityName} key "${key}" format is invalid`,
      context: {
        value,
        invalidKey: key,
        pattern: pattern.toString(),
        operation: 'key_pattern_check',
        ...(keyPatternDescription && {
          expectedKeyFormat: keyPatternDescription,
        }),
      },
    }),
  };
}

export type RecordVOInstance = {
  readonly value: Record<string, unknown>;
  readonly keys: string[];
  readonly values: unknown[];
  readonly size: number;
  readonly isEmpty: boolean;
  has(key: string): boolean;
  get(key: string): unknown;
  merge(other: RecordVOInstance): Result<RecordVOInstance, DomainError>;
  pick(keys: string[]): Result<RecordVOInstance, DomainError>;
  omit(keys: string[]): Result<RecordVOInstance, DomainError>;
  set(key: string, value: unknown): Result<RecordVOInstance, DomainError>;
  delete(key: string): Result<RecordVOInstance, DomainError>;
  equals(other: RecordVOInstance): boolean;
  compare(other: RecordVOInstance): -1 | 0 | 1;
  toString(): string;
  toJSON(): { value: Record<string, unknown>; type: string };
};

/**
 * Key transformation options for record normalization
 */
export type KeyCase = 'none' | 'lower' | 'upper' | 'camel' | 'snake' | 'kebab';

/**
 * Business rule refinement for additional validation
 */
export interface RecordRefinement {
  /** Name of the refinement rule (for debugging and error context) */
  name: string;
  /** Test function that returns true if the value passes the rule */
  test: (value: Record<string, unknown>) => boolean;
  /** Error factory function called when the test fails */
  createError: (value: Record<string, unknown>) => DomainError;
}

/**
 * Configuration interface for record value objects
 */
export interface RecordVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Allow empty records */
  allowEmpty?: boolean;
  /** Minimum number of keys */
  minKeys?: number;
  /** Maximum number of keys */
  maxKeys?: number;
  /** Regex pattern validation for keys */
  keyPattern?: RegExp;
  /** Transform case of keys during normalization */
  keyCase?: KeyCase;
  /** List of required keys that must be present */
  requiredKeys?: string[];
  /** List of forbidden keys that must not be present */
  forbiddenKeys?: string[];
  /** Business rule refinements for additional validation */
  refinements?: RecordRefinement[];
  /** Custom validation function for business rules */
  customValidation?: (
    value: Record<string, unknown>,
  ) => Result<Record<string, unknown>, DomainError>;

  // Template properties
  /** Whether the record is required (cannot be null/undefined) */
  required?: boolean;

  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    empty: (value: Record<string, unknown>) => DomainError;
    tooFewKeys: (value: Record<string, unknown>, min: number) => DomainError;
    tooManyKeys: (value: Record<string, unknown>, max: number) => DomainError;
    invalidKey: (
      value: Record<string, unknown>,
      key: string,
      pattern: RegExp,
    ) => DomainError;
    forbiddenKey: (value: Record<string, unknown>, key: string) => DomainError;
    requiredKey: (value: Record<string, unknown>, key: string) => DomainError;
    custom?: (value: Record<string, unknown>, reason: string) => DomainError;
    required?: () => DomainError;
  };
}

/**
 * Factory function to create record-based value objects
 * Provides consistent validation, normalization, and operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createRecordVO(config: RecordVOConfig) {
  // Configuration with defaults
  const ALLOW_EMPTY = config.allowEmpty ?? false;
  const KEY_CASE = config.keyCase ?? 'none';

  /**
   * Transform key case based on configuration
   */
  const transformKey = (key: string): string => {
    switch (KEY_CASE) {
      case 'lower':
        return key.toLowerCase();
      case 'upper':
        return key.toUpperCase();
      case 'camel':
        return key.replace(/_([a-z])/g, (_: string, letter: string) =>
          letter.toUpperCase(),
        );
      case 'snake':
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
      case 'kebab':
        return key.replace(/([A-Z])/g, '-$1').toLowerCase();
      default:
        return key;
    }
  };

  /**
   * Apply normalization rules (key transformation)
   */
  const normalize = (
    input: Record<string, unknown>,
  ): Record<string, unknown> => {
    if (KEY_CASE === 'none') {
      return { ...input };
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const transformedKey = transformKey(key);
      normalized[transformedKey] = value;
    }
    return normalized;
  };

  /**
   * Validate normalized record against configuration rules
   */
  const validate = (
    value: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> => {
    const keys = Object.keys(value);

    // Empty check
    if (!ALLOW_EMPTY && keys.length === 0) {
      return err(config.errors.empty(value));
    }

    // Minimum keys check
    if (typeof config.minKeys === 'number' && keys.length < config.minKeys) {
      return err(config.errors.tooFewKeys(value, config.minKeys));
    }

    // Maximum keys check
    if (typeof config.maxKeys === 'number' && keys.length > config.maxKeys) {
      return err(config.errors.tooManyKeys(value, config.maxKeys));
    }

    // Key pattern validation
    if (config.keyPattern) {
      for (const key of keys) {
        if (!config.keyPattern.test(key)) {
          return err(config.errors.invalidKey(value, key, config.keyPattern));
        }
      }
    }

    // Required keys validation
    if (config.requiredKeys) {
      for (const requiredKey of config.requiredKeys) {
        if (!keys.includes(requiredKey)) {
          return err(config.errors.requiredKey(value, requiredKey));
        }
      }
    }

    // Forbidden keys validation
    if (config.forbiddenKeys) {
      for (const forbiddenKey of config.forbiddenKeys) {
        if (keys.includes(forbiddenKey)) {
          return err(config.errors.forbiddenKey(value, forbiddenKey));
        }
      }
    }

    // Refinements validation (business rules)
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
   * Record Value Object implementation
   * Generated dynamically based on configuration
   */
  return class RecordVO {
    public readonly _value: Record<string, unknown>;

    protected constructor(value: Record<string, unknown>) {
      this._value = value;
    }

    /**
     * Create value object from record with validation
     */
    static create(
      value?: Record<string, unknown> | null,
    ): Result<RecordVO, DomainError> {
      // Handle required validation
      if (config.required && (value === null || value === undefined)) {
        return err(config.errors.required?.() ?? config.errors.type(value));
      }

      // Handle optional null/undefined values
      if (!config.required && (value === null || value === undefined)) {
        return err(config.errors.type(value));
      }

      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return err(config.errors.type(value));
      }

      const normalized = normalize(value);
      const validationResult = validate(normalized);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new RecordVO(validationResult.value));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<RecordVO, DomainError> {
      // Handle required validation
      if (config.required && (value === null || value === undefined)) {
        return err(config.errors.required?.() ?? config.errors.type(value));
      }

      // Handle optional null/undefined values
      if (!config.required && (value === null || value === undefined)) {
        return err(config.errors.type(value));
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return this.create(value as Record<string, unknown>);
      }

      return err(config.errors.type(value));
    }

    /**
     * Create empty record
     */
    static empty(): Result<RecordVO, DomainError> {
      return this.create({});
    }

    // ==================== Accessors ====================

    /** Get the record value */
    get value(): Record<string, unknown> {
      return { ...this._value };
    }

    /** Get array of keys */
    get keys(): string[] {
      return Object.keys(this._value);
    }

    /** Get array of values */
    get values(): unknown[] {
      return Object.values(this._value);
    }

    /** Get number of keys */
    get size(): number {
      return Object.keys(this._value).length;
    }

    /** Check if record is empty */
    get isEmpty(): boolean {
      return Object.keys(this._value).length === 0;
    }

    // ==================== Operations ====================

    /**
     * Check if key exists
     */
    has(key: string): boolean {
      return key in this._value;
    }

    /**
     * Get value by key
     */
    get(key: string): unknown {
      return this._value[key];
    }

    /**
     * Merge with another RecordVO (re-validates result)
     */
    merge(other: RecordVO): Result<RecordVO, DomainError> {
      const merged = { ...this._value, ...other._value };
      return RecordVO.create(merged);
    }

    /**
     * Pick specific keys (re-validates result)
     */
    pick(keys: string[]): Result<RecordVO, DomainError> {
      const picked: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in this._value) {
          picked[key] = this._value[key];
        }
      }
      return RecordVO.create(picked);
    }

    /**
     * Omit specific keys (re-validates result)
     */
    omit(keys: string[]): Result<RecordVO, DomainError> {
      const omitted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this._value)) {
        if (!keys.includes(key)) {
          omitted[key] = value;
        }
      }
      return RecordVO.create(omitted);
    }

    /**
     * Set a key-value pair (re-validates result)
     */
    set(key: string, value: unknown): Result<RecordVO, DomainError> {
      const updated = { ...this._value, [key]: value };
      return RecordVO.create(updated);
    }

    /**
     * Delete a key (re-validates result)
     */
    delete(key: string): Result<RecordVO, DomainError> {
      const updated = { ...this._value };
      delete updated[key];
      return RecordVO.create(updated);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another RecordVO (deep comparison)
     */
    equals(other: RecordVO): boolean {
      const thisKeys = Object.keys(this._value).sort();
      const otherKeys = Object.keys(other._value).sort();

      if (thisKeys.length !== otherKeys.length) {
        return false;
      }

      for (let i = 0; i < thisKeys.length; i++) {
        if (thisKeys[i] !== otherKeys[i]) {
          return false;
        }
        if (this._value[thisKeys[i]] !== other._value[thisKeys[i]]) {
          return false;
        }
      }

      return true;
    }

    /**
     * Compare with another RecordVO (lexicographical by JSON string)
     */
    compare(other: RecordVO): -1 | 0 | 1 {
      const thisStr = JSON.stringify(
        this._value,
        Object.keys(this._value).sort(),
      );
      const otherStr = JSON.stringify(
        other._value,
        Object.keys(other._value).sort(),
      );
      if (thisStr < otherStr) return -1;
      if (thisStr > otherStr) return 1;
      return 0;
    }

    // ==================== Serialization ====================

    /**
     * Convert to string representation
     */
    toString(): string {
      return JSON.stringify(this._value);
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: Record<string, unknown>; type: string } {
      return {
        value: this.value,
        type: config.name,
      };
    }
  };
}
