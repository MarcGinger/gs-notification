/**
 * Repository JSON parsing utilities
 *
 * Provides safe JSON parsing functions for database interactions,
 * handling the differences between database drivers and ensuring
 * proper error handling with domain errors.
 */

import { Result, DomainError, err } from '../../errors';
import { RepositoryErrorFactory } from '../../domain/errors/repository.error';

/**
 * Safely parse JSON data from database columns with proper error handling
 *
 * TypeORM query results can vary by database driver:
 * - PostgreSQL: JSONB fields return as objects directly
 * - Other drivers: JSONB fields return as JSON strings
 *
 * This function handles both cases and provides structured error handling
 * for malformed JSON data using domain errors.
 *
 * @param raw - The raw value from the database (can be object, string, or null)
 * @param field - The field name for error context
 * @returns Parsed value of type T, or undefined if raw is null/undefined
 * @throws Error with attached domainError property for mapping errors
 *
 * @example
 * ```typescript
 * // Parse optional JSON field
 * const metadata = safeParseJSON<Record<string, unknown>>(row.metadata, 'metadata');
 *
 * // Parse required JSON field with validation
 * const config = safeParseJSON<ConfigProps>(row.config, 'config');
 * if (!config) {
 *   return err(RepositoryErrorFactory.validationError('config', 'Missing required configuration'));
 * }
 * ```
 */
export function safeParseJSON<T>(raw: unknown, field: string): T {
  if (raw == null) return undefined as T;

  try {
    // Handle both object (PostgreSQL) and string (other drivers) cases
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v as T;
  } catch (e) {
    // Create a wrapper Error with mapping error details for proper domain error handling
    const mappingError = RepositoryErrorFactory.mappingError(
      field,
      `Invalid JSON in column "${field}": ${(e as Error).message}`,
    );
    const error = new Error('JSON mapping error occurred');
    // Attach the domain error for extraction in catch blocks
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (error as any).domainError = mappingError;
    throw error;
  }
}

/**
 * Parse and validate JSON array with element type checking
 *
 * @param raw - The raw value from the database
 * @param field - The field name for error context
 * @param elementValidator - Function to validate each array element
 * @returns Parsed array of type T[], or empty array if validation fails
 *
 * @example
 * ```typescript
 * // Parse string array
 * const channels = safeParseJSONArray(
 *   row.channel_codes,
 *   'channel_codes',
 *   (x): x is string => typeof x === 'string'
 * );
 *
 * // Parse number array
 * const railCodes = safeParseJSONArray(
 *   row.rail_codes,
 *   'rail_codes',
 *   (x): x is number => Number.isInteger(x)
 * );
 * ```
 */
export function safeParseJSONArray<T>(
  raw: unknown,
  field: string,
  elementValidator: (x: unknown) => x is T,
): T[] {
  const parsed = safeParseJSON<unknown>(raw, field);

  if (!Array.isArray(parsed)) {
    return [];
  }

  // Validate all elements match the expected type
  if (parsed.every(elementValidator)) {
    return parsed;
  }

  // Return empty array for invalid elements (graceful fallback)
  // Could alternatively throw mapping error for strict validation
  return [];
}

/**
 * Parse JSON with required validation
 *
 * @param raw - The raw value from the database
 * @param field - The field name for error context
 * @returns Parsed value of type T
 * @throws Error with attached domainError if the field is null or parsing fails
 *
 * @example
 * ```typescript
 * // Parse required JSON field - will throw if null or invalid
 * const requiredConfig = safeParseRequiredJSON<ConfigProps>(row.config, 'config');
 * ```
 */
export function safeParseRequiredJSON<T>(raw: unknown, field: string): T {
  if (raw == null) {
    const mappingError = RepositoryErrorFactory.mappingError(
      field,
      `Required JSON field "${field}" is null or undefined`,
    );
    const error = new Error('Required JSON field missing');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (error as any).domainError = mappingError;
    throw error;
  }

  const result = safeParseJSON<T>(raw, field);
  if (result === undefined) {
    const mappingError = RepositoryErrorFactory.mappingError(
      field,
      `Required JSON field "${field}" could not be parsed`,
    );
    const error = new Error('Required JSON field parsing failed');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (error as any).domainError = mappingError;
    throw error;
  }

  return result;
}

/**
 * Handle repository operation errors with standardized error classification
 *
 * This utility function provides consistent error handling across repository operations,
 * properly classifying and returning domain errors from various sources:
 * - Wrapped domain errors from JSON parsing utilities
 * - Direct domain errors from mapping operations
 * - Legacy mapping errors (for backward compatibility)
 * - Generic connection/database errors
 *
 * @param error - The caught error (can be DomainError, Error, or unknown)
 * @returns Result.err with the appropriate DomainError classification
 *
 * @example
 * ```typescript
 * import { handleRepositoryError } from 'src/shared/infrastructure/repositories';
 *
 * try {
 *   // ... repository operation
 * } catch (error) {
 *   // Log the error first
 *   RepositoryLoggingUtil.logOperationError(logger, operation, logContext, error as Error, 'HIGH');
 *
 *   // Then handle and return the classified error
 *   return handleRepositoryError(error);
 * }
 * ```
 */
export function handleRepositoryError(
  error: unknown,
): Result<never, DomainError> {
  const e = error as DomainError | Error;

  // If it's a wrapped DomainError from mappingError utilities, return it
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if ((e as any).domainError) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return err((e as any).domainError as DomainError);
  }

  // If it's already a DomainError from mappingError, return it
  const isDomainError = e && typeof e === 'object' && 'code' in e;
  if (isDomainError && e.code?.startsWith('REPOSITORY.MAPPING')) {
    return err(e);
  }

  // Handle legacy mapping errors specifically (for backward compatibility)
  if ((e as Error).message?.startsWith('MAPPING_ERROR:')) {
    const [, field, message] = (e as Error).message.split(':', 3);
    return err(RepositoryErrorFactory.validationError(field, message));
  }

  // Default to connection error for any other database-related errors
  return err(RepositoryErrorFactory.connectionError((e as Error).message));
}
