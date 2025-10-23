import { DomainError, Result, ok, err, withContext } from './error.types';
import { AppConfigUtil } from '../config/app-config.util';

/**
 * Error catalog for catalog operations
 */
const CatalogErrorDefinitions = {
  CATALOG_VALIDATION_FAILED: {
    title: 'Catalog validation failed',
    detail: 'One or more catalog definitions do not follow naming conventions',
    category: 'validation' as const,
  },
  DUPLICATE_CATALOG_KEY: {
    title: 'Duplicate catalog key found',
    detail: 'Multiple catalogs contain the same key when merging',
    category: 'validation' as const,
  },
  DUPLICATE_ERROR_CODE: {
    title: 'Duplicate error code found',
    detail: 'Multiple catalogs contain the same error code when merging',
    category: 'validation' as const,
  },
} as const;

/**
 * Catalog error catalog with namespaced error codes
 */
export const CatalogErrors = Object.fromEntries(
  Object.entries(CatalogErrorDefinitions).map(([key, errorDef]) => {
    const code = `CATALOG.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof CatalogErrorDefinitions]: DomainError<`CATALOG.${Extract<K, string>}`>;
};

/**
 * Creates a typed error catalog with namespaced error codes.
 *
 * This helper function takes a set of error definitions and a namespace,
 * then creates a catalog where each error gets a prefixed code.
 *
 * In development environments, this will automatically validate naming
 * conventions and log warnings for any violations.
 *
 * @param definitions Object containing error definitions without codes
 * @param namespace Prefix for all error codes (e.g., 'USER', 'ORDER')
 * @returns Typed catalog with namespaced error codes
 *
 * @example
 * ```typescript
 * const UserErrors = makeCatalog({
 *   USER_NOT_FOUND: {
 *     title: 'User not found',
 *     category: 'domain',
 *   },
 *   INVALID_EMAIL: {
 *     title: 'Invalid email format',
 *     category: 'validation',
 *   }
 * }, 'USER');
 *
 * // Results in:
 * // UserErrors.USER_NOT_FOUND.code === 'USER.USER_NOT_FOUND'
 * // UserErrors.INVALID_EMAIL.code === 'USER.INVALID_EMAIL'
 * ```
 */
export function makeCatalog<
  T extends Record<string, Omit<DomainError, 'code'>>,
>(definitions: T, namespace: string) {
  // Auto-validate in development environments
  if (!AppConfigUtil.isProduction()) {
    const validationErrors = validateCatalogNaming(definitions);
    if (validationErrors.length > 0) {
      console.warn(
        `[Error Catalog Warning] Namespace "${namespace}" has naming violations:\n` +
          validationErrors.map((err) => `  - ${err}`).join('\n'),
      );
    }
  }

  return Object.fromEntries(
    Object.entries(definitions).map(([key, errorDef]) => {
      const code = `${namespace}.${key}` as const;
      return [key, { ...errorDef, code }];
    }),
  ) as {
    [K in keyof T]: DomainError<`${typeof namespace}.${Extract<K, string>}`>;
  };
}

/**
 * Type helper to extract error codes from a catalog.
 * Useful for creating union types of valid error codes.
 *
 * @example
 * ```typescript
 * const UserErrors = makeCatalog({ ... }, 'USER');
 * type UserErrorCode = CatalogErrorCode<typeof UserErrors>;
 * // Results in: 'USER.USER_NOT_FOUND' | 'USER.INVALID_EMAIL' | ...
 * ```
 */
export type CatalogErrorCode<T extends Record<string, DomainError>> =
  T[keyof T]['code'];

/**
 * Type helper to extract all errors from a catalog.
 * Useful for creating union types of all possible errors.
 *
 * @example
 * ```typescript
 * const UserErrors = makeCatalog({ ... }, 'USER');
 * type UserError = CatalogError<typeof UserErrors>;
 * ```
 */
export type CatalogError<T extends Record<string, DomainError>> = T[keyof T];

/**
 * Validates that all errors in a catalog follow naming conventions.
 * Checks that error keys are UPPER_SNAKE_CASE.
 *
 * @param definitions Error definitions to validate
 * @returns Array of validation errors with detailed feedback, empty if all valid
 */
export function validateCatalogNaming<
  T extends Record<string, Omit<DomainError, 'code'>>,
>(definitions: T): string[] {
  const errors: string[] = [];
  const upperSnakeCasePattern = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

  Object.keys(definitions).forEach((key) => {
    if (!upperSnakeCasePattern.test(key)) {
      // Convert the key to suggested UPPER_SNAKE_CASE format
      const suggested = key
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Handle camelCase: camelCase -> camel_Case
        .replace(/[^A-Za-z0-9_]/g, '_') // Replace invalid chars with underscore
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .toUpperCase();

      errors.push(
        `Error key "${key}" should be UPPER_SNAKE_CASE. ` +
          `Suggestion: "${suggested}". ` +
          `Pattern: ${upperSnakeCasePattern.toString()}`,
      );
    }
  });

  return errors;
}

/**
 * Creates a validated catalog safely with Result pattern
 *
 * @param definitions Error definitions
 * @param namespace Namespace for error codes
 * @returns Result containing validated error catalog or validation error
 */
export function makeValidatedCatalogSafe<
  T extends Record<string, Omit<DomainError, 'code'>>,
>(
  definitions: T,
  namespace: string,
): Result<
  {
    [K in keyof T]: DomainError<`${typeof namespace}.${Extract<K, string>}`>;
  },
  DomainError
> {
  const validationErrors = validateCatalogNaming(definitions);

  if (validationErrors.length > 0) {
    return err(
      withContext(CatalogErrors.CATALOG_VALIDATION_FAILED, {
        namespace,
        validationErrors,
        errorCount: validationErrors.length,
        suggestions: validationErrors
          .map((error) => {
            const match = error.match(/Suggestion: "([^"]+)"/);
            return match ? match[1] : '';
          })
          .filter(Boolean),
      }),
    );
  }

  return ok(makeCatalog(definitions, namespace));
}

/**
 * Merges multiple error catalogs safely with Result pattern
 * Useful when you need to combine errors from different domains.
 *
 * Performs comprehensive collision detection:
 * - Checks for duplicate catalog keys
 * - Checks for duplicate error codes across different catalogs
 *
 * @param catalogs Multiple error catalogs to merge
 * @returns Result containing combined catalog or collision error
 *
 * @example
 * ```typescript
 * const result = mergeCatalogsSafe(UserErrors, OrderErrors, PaymentErrors);
 * if (result.ok) {
 *   const AllErrors = result.value;
 * }
 * ```
 */
export function mergeCatalogsSafe<
  T extends Record<string, Record<string, DomainError>>,
>(...catalogs: T[keyof T][]): Result<Record<string, DomainError>, DomainError> {
  const merged: Record<string, DomainError> = {};

  for (const catalog of catalogs) {
    for (const [key, error] of Object.entries(catalog)) {
      // Check for duplicate catalog keys
      if (merged[key]) {
        return err(
          withContext(CatalogErrors.DUPLICATE_CATALOG_KEY, {
            duplicateKey: key,
            existingCode: merged[key].code,
            newCode: error.code,
            operation: 'catalog-merge',
          }),
        );
      }

      // Check for duplicate error codes (same code from different catalogs)
      const existingErrorWithSameCode = Object.values(merged).find(
        (existingError) => existingError.code === error.code,
      );

      if (existingErrorWithSameCode) {
        return err(
          withContext(CatalogErrors.DUPLICATE_ERROR_CODE, {
            duplicateCode: error.code,
            operation: 'catalog-merge',
            catalogCount: catalogs.length,
          }),
        );
      }

      merged[key] = error;
    }
  }

  return ok(merged);
}
