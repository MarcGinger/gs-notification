import { Result, ok, err, DomainError } from '../../errors';
import { randomUUID } from 'crypto';

/**
 * Interface for defining UUID business rules/refinements
 */
export interface UuidRefinement {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: string) => boolean;
  /** Create error when test fails */
  createError: (value: string) => DomainError;
}

/**
 * Creates standardized error factory functions for UUID value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., UserErrors.INVALID_ID)
 * @param entityName - Human-readable name for the entity (e.g., 'User ID', 'Transaction ID')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createUuidVOErrors } from 'src/shared/domain/value-objects/uuid-vo';
 * import { UserErrors } from '../errors/user.errors';
 *
 * export const UserId = createUuidVO({
 *   name: 'UserId',
 *   version: 4,
 *   errors: createUuidVOErrors(UserErrors.INVALID_ID, 'User ID'),
 * });
 * ```
 */
export function createUuidVOErrors(baseError: DomainError, entityName: string) {
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

    invalid: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a valid UUID, received: ${String(value)}`,
      context: {
        value,
        operation: 'uuid_validation',
      },
    }),

    version: (value: string, expected: number, actual: number) => ({
      ...baseError,
      detail: `${entityName} must be UUID version ${expected}, received version ${actual}`,
      context: {
        value,
        expectedVersion: expected,
        actualVersion: actual,
        operation: 'version_check',
      },
    }),

    variant: (value: string, expected: string, actual: string) => ({
      ...baseError,
      detail: `${entityName} must be UUID variant ${expected}, received variant ${actual}`,
      context: {
        value,
        expectedVariant: expected,
        actualVariant: actual,
        operation: 'variant_check',
      },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: {
        operation: 'required_validation',
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
  };
}

export type UuidVOInstance = {
  readonly value: string;
  readonly version: 1 | 3 | 4 | 5;
  readonly variant: 'rfc4122' | 'microsoft' | 'future';
  equals(other: UuidVOInstance): boolean;
  compare(other: UuidVOInstance): -1 | 0 | 1;
  toString(): string;
  toJSON(): { value: string; version: number; variant: string; type: string };
};

/**
 * Configuration interface for UUID value objects
 */
export interface UuidVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Expected UUID version (1, 3, 4, or 5) */
  version?: 1 | 3 | 4 | 5;
  /** Expected UUID variant */
  variant?: 'rfc4122' | 'microsoft' | 'future';
  /** Business rule refinements for domain validation */
  refinements?: UuidRefinement[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: string) => Result<void, DomainError>;

  // Template properties
  /** Whether the UUID is required (cannot be null/undefined) */
  required?: boolean;
  /** Accept UUID format without hyphens (e.g., "550e8400e29b41d4a716446655440000") */
  acceptHyphenless?: boolean;
  /** Accept UUID format with braces (e.g., "{550e8400-e29b-41d4-a716-446655440000}") */
  acceptBraced?: boolean;
  /** Normalize output format: 'lowercase', 'uppercase', 'compact', 'braced' */
  normalize?: 'lowercase' | 'uppercase' | 'compact' | 'braced';

  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    invalid: (value: unknown) => DomainError;
    version: (value: string, expected: number, actual: number) => DomainError;
    variant: (value: string, expected: string, actual: string) => DomainError;
    required?: () => DomainError;
  };
}

/**
 * Factory function to create UUID-based value objects
 * Provides consistent validation and UUID operations
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createUuidVO(config: UuidVOConfig) {
  // Configuration with defaults
  const EXPECTED_VERSION = config.version;
  const EXPECTED_VARIANT = config.variant;

  // UUID regex patterns for different formats
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const UUID_HYPHENLESS_REGEX = /^[0-9a-f]{32}$/i;
  const UUID_BRACED_REGEX =
    /^{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}$/i;

  /**
   * Normalize UUID to standard format (with hyphens, lowercase)
   */
  const normalizeToStandard = (input: string): string => {
    let uuid = input.toLowerCase();

    // Remove braces if present
    if (uuid.startsWith('{') && uuid.endsWith('}')) {
      uuid = uuid.slice(1, -1);
    }

    // Add hyphens if missing
    if (uuid.length === 32 && !uuid.includes('-')) {
      uuid = [
        uuid.slice(0, 8),
        uuid.slice(8, 12),
        uuid.slice(12, 16),
        uuid.slice(16, 20),
        uuid.slice(20, 32),
      ].join('-');
    }

    return uuid;
  };

  /**
   * Apply output normalization based on config
   */
  const applyNormalization = (uuid: string): string => {
    switch (config.normalize) {
      case 'uppercase':
        return uuid.toUpperCase();
      case 'compact':
        return uuid.replace(/-/g, '');
      case 'braced':
        return `{${uuid}}`;
      case 'lowercase':
      default:
        return uuid.toLowerCase();
    }
  };

  /**
   * Extract UUID version from UUID string
   */
  const extractVersion = (uuid: string): number => {
    const versionChar = uuid.charAt(14);
    return parseInt(versionChar, 16);
  };

  /**
   * Extract UUID variant from UUID string
   */
  const extractVariant = (uuid: string): string => {
    const variantChar = uuid.charAt(19);
    const variantNibble = parseInt(variantChar, 16);

    if ((variantNibble & 0x8) === 0x8) {
      if ((variantNibble & 0xc) === 0xc) {
        return 'future';
      } else if ((variantNibble & 0xa) === 0xa) {
        return 'microsoft';
      } else {
        return 'rfc4122';
      }
    }
    return 'future';
  };

  /**
   * Validate UUID format and constraints
   */
  const validate = (
    value: string,
  ): Result<
    { uuid: string; version: number; variant: string },
    DomainError
  > => {
    if (typeof value !== 'string') {
      return err(config.errors.type(value));
    }

    // Check if value matches any accepted format
    let isValidFormat = UUID_REGEX.test(value);

    if (!isValidFormat && config.acceptHyphenless) {
      isValidFormat = UUID_HYPHENLESS_REGEX.test(value);
    }

    if (!isValidFormat && config.acceptBraced) {
      isValidFormat = UUID_BRACED_REGEX.test(value);
    }

    if (!isValidFormat) {
      return err(config.errors.invalid(value));
    }

    // Normalize to standard format for version/variant extraction
    const normalizedUuid = normalizeToStandard(value);

    const version = extractVersion(normalizedUuid);
    const variant = extractVariant(normalizedUuid);

    // Check version constraint
    if (EXPECTED_VERSION !== undefined && version !== EXPECTED_VERSION) {
      return err(
        config.errors.version(normalizedUuid, EXPECTED_VERSION, version),
      );
    }

    // Check variant constraint
    if (EXPECTED_VARIANT !== undefined && variant !== EXPECTED_VARIANT) {
      return err(
        config.errors.variant(normalizedUuid, EXPECTED_VARIANT, variant),
      );
    }

    // Apply output normalization
    const finalUuid = applyNormalization(normalizedUuid);

    // Process refinements (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(finalUuid)) {
          return err(refinement.createError(finalUuid));
        }
      }
    }

    // Process custom validation
    if (config.customValidation) {
      const customResult = config.customValidation(finalUuid);
      if (!customResult.ok) {
        return err(customResult.error);
      }
    }

    return ok({ uuid: finalUuid, version, variant });
  };

  /**
   * UUID Value Object implementation
   * Generated dynamically based on configuration
   */
  return class UuidVO {
    public readonly _value: string;
    public readonly _version: number;
    public readonly _variant: string;

    protected constructor(value: string, version: number, variant: string) {
      this._value = value;
      this._version = version;
      this._variant = variant;
    }

    /**
     * Create value object from UUID string with validation
     */
    static create(value?: string | null): Result<UuidVO, DomainError> {
      // Handle required validation
      if (config.required && (value === null || value === undefined)) {
        return err(config.errors.required?.() ?? config.errors.invalid(value));
      }

      // Handle optional null/undefined values
      if (!config.required && (value === null || value === undefined)) {
        return err(config.errors.type(value));
      }

      const validationResult = validate(value!);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      const { uuid, version, variant } = validationResult.value;
      return ok(new UuidVO(uuid, version, variant));
    }

    /**
     * Create value object from unknown value
     */
    static from(value: unknown): Result<UuidVO, DomainError> {
      // Handle required validation
      if (config.required && (value === null || value === undefined)) {
        return err(config.errors.required?.() ?? config.errors.invalid(value));
      }

      // Handle optional null/undefined values
      if (!config.required && (value === null || value === undefined)) {
        return err(config.errors.type(value));
      }

      if (typeof value === 'string') {
        return this.create(value);
      }

      return err(config.errors.type(value));
    }

    /**
     * Generate a new random UUID v4
     */
    static generate(): Result<UuidVO, DomainError> {
      try {
        const uuid = randomUUID();
        return this.create(uuid);
      } catch {
        return err(config.errors.invalid('Failed to generate UUID'));
      }
    }

    /**
     * Generate a new UUID with specific version (if supported)
     */
    static generateV4(): Result<UuidVO, DomainError> {
      return this.generate();
    }

    // ==================== Accessors ====================

    /** Get the UUID string value */
    get value(): string {
      return this._value;
    }

    /** Get the UUID version */
    get version(): 1 | 3 | 4 | 5 {
      return this._version as 1 | 3 | 4 | 5;
    }

    /** Get the UUID variant */
    get variant(): 'rfc4122' | 'microsoft' | 'future' {
      return this._variant as 'rfc4122' | 'microsoft' | 'future';
    }

    /** Check if this is a nil UUID (all zeros) */
    get isNil(): boolean {
      return this._value === '00000000-0000-0000-0000-000000000000';
    }

    // ==================== Operations ====================

    /**
     * Check equality with another UUIDVO
     */
    equals(other: UuidVO): boolean {
      return this._value === other._value;
    }

    /**
     * Compare with another UUIDVO (lexicographical comparison)
     */
    compare(other: UuidVO): -1 | 0 | 1 {
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Get the UUID without hyphens
     */
    get compact(): string {
      return this._value.replace(/-/g, '');
    }

    /**
     * Get the UUID with uppercase letters
     */
    get uppercase(): string {
      return this._value.toUpperCase();
    }

    /**
     * Get the UUID with lowercase letters
     */
    get lowercase(): string {
      return this._value.toLowerCase();
    }

    /**
     * Get the UUID with braces
     */
    get braced(): string {
      return `{${this._value}}`;
    }

    /**
     * Get the normalized UUID based on configuration
     */
    get normalized(): string {
      return applyNormalization(this._value);
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
    toJSON(): {
      value: string;
      version: number;
      variant: string;
      type: string;
    } {
      return {
        value: this._value,
        version: this._version,
        variant: this._variant,
        type: config.name,
      };
    }
  };
}
