import { DomainError } from '../errors';

/**
 * Standard validation operation names for consistent error reporting
 */
export const ValidationOperations = {
  TYPE_CHECK: 'type_check',
  RANGE_CHECK: 'range_check',
  LENGTH_CHECK: 'length_check',
  PATTERN_CHECK: 'pattern_check',
  FORMAT_CHECK: 'format_validation',
  CUSTOM_VALIDATION: 'custom_validation',
  REQUIRED_CHECK: 'required_check',
  BUSINESS_RULE: 'business_rule',
  REFINEMENT: 'refinement',
  SANITIZATION: 'sanitization',
} as const;

/**
 * Standard error context structure for consistent error reporting
 */
export interface StandardErrorContext {
  /** The input value that caused the error */
  value?: unknown;
  /** The validation operation that failed */
  operation: string;
  /** What value/format was expected */
  expected?: unknown;
  /** What value/format was actually received */
  received?: unknown;
  /** The constraint that was violated (min/max/pattern/etc.) */
  constraint?: unknown;
  /** Human-readable reason for the failure */
  reason?: string;
  /** Additional domain-specific context */
  [key: string]: unknown;
}

/**
 * Utility functions for creating standardized validation errors
 */
export class ValidationErrorFactory {
  /**
   * Creates a standardized type validation error
   */
  static createTypeError(
    baseError: DomainError,
    entityName: string,
    value: unknown,
    expectedType: string,
  ): DomainError {
    return {
      ...baseError,
      detail: `${entityName} must be a ${expectedType}, received: ${typeof value}`,
      context: {
        value,
        operation: ValidationOperations.TYPE_CHECK,
        expected: expectedType,
        received: typeof value,
      },
    };
  }

  /**
   * Creates a standardized range validation error
   */
  static createRangeError(
    baseError: DomainError,
    entityName: string,
    value: number | Date,
    constraint: { min?: number | Date; max?: number | Date },
    violationType: 'min' | 'max',
  ): DomainError {
    const isMin = violationType === 'min';
    const constraintValue = isMin ? constraint.min : constraint.max;
    const operator = isMin ? 'at least' : 'no more than';

    return {
      ...baseError,
      detail: `${entityName} must be ${operator} ${String(constraintValue)}`,
      context: {
        value,
        operation: ValidationOperations.RANGE_CHECK,
        constraint: constraintValue,
        violationType,
        ...constraint,
      },
    };
  }

  /**
   * Creates a standardized pattern validation error
   */
  static createPatternError(
    baseError: DomainError,
    entityName: string,
    value: string,
    pattern: RegExp,
    patternDescription?: string,
  ): DomainError {
    const description = patternDescription || 'the required format';

    return {
      ...baseError,
      detail: `${entityName} must match ${description}`,
      context: {
        value,
        operation: ValidationOperations.PATTERN_CHECK,
        pattern: pattern.toString(),
        patternDescription: description,
      },
    };
  }

  /**
   * Creates a standardized required field error
   */
  static createRequiredError(
    baseError: DomainError,
    entityName: string,
  ): DomainError {
    return {
      ...baseError,
      detail: `${entityName} is required`,
      context: {
        operation: ValidationOperations.REQUIRED_CHECK,
      },
    };
  }

  /**
   * Creates a standardized custom validation error
   */
  static createCustomError(
    baseError: DomainError,
    entityName: string,
    value: unknown,
    reason: string,
  ): DomainError {
    return {
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value,
        operation: ValidationOperations.CUSTOM_VALIDATION,
        reason,
      },
    };
  }

  /**
   * Creates a standardized length validation error
   */
  static createLengthError(
    baseError: DomainError,
    entityName: string,
    value: string | unknown[],
    constraint: { minLength?: number; maxLength?: number },
    violationType: 'min' | 'max',
  ): DomainError {
    const isMin = violationType === 'min';
    const constraintValue = isMin ? constraint.minLength : constraint.maxLength;
    const operator = isMin ? 'at least' : 'no more than';
    const actualLength =
      typeof value === 'string'
        ? value.length
        : Array.isArray(value)
          ? value.length
          : 0;

    return {
      ...baseError,
      detail: `${entityName} must have ${operator} ${constraintValue} characters`,
      context: {
        value,
        operation: ValidationOperations.LENGTH_CHECK,
        actualLength,
        constraintValue,
        violationType,
        ...constraint,
      },
    };
  }
}

/**
 * Common validation patterns that can be reused across value objects
 */
export class CommonValidationPatterns {
  /** Email regex pattern */
  static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** URL regex pattern */
  static readonly URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  /** UUID v4 regex pattern */
  static readonly UUID_V4_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /** Basic alphanumeric pattern */
  static readonly ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9]+$/;

  /** Phone number pattern (basic international format) */
  static readonly PHONE_PATTERN = /^\+?[1-9]\d{1,14}$/;

  /**
   * Validates email format
   */
  static validateEmail(email: string): boolean {
    return this.EMAIL_PATTERN.test(email);
  }

  /**
   * Validates URL format
   */
  static validateUrl(url: string): boolean {
    return this.URL_PATTERN.test(url);
  }

  /**
   * Validates UUID v4 format
   */
  static validateUuidV4(uuid: string): boolean {
    return this.UUID_V4_PATTERN.test(uuid);
  }

  /**
   * Validates phone number format
   */
  static validatePhone(phone: string): boolean {
    return this.PHONE_PATTERN.test(phone);
  }
}
