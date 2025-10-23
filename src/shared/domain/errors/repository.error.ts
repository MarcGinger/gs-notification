import { DomainError } from '../../errors';

/**
 * Repository-specific error catalog
 */
export const RepositoryErrors = {
  CONCURRENCY_CONFLICT: {
    code: 'REPOSITORY.CONCURRENCY_CONFLICT',
    title: 'Concurrency conflict detected',
    category: 'domain',
    retryable: true,
  } as const satisfies DomainError,

  NOT_FOUND: {
    code: 'REPOSITORY.NOT_FOUND',
    title: 'Entity not found',
    category: 'domain',
    retryable: false,
  } as const satisfies DomainError,

  CONNECTION_ERROR: {
    code: 'REPOSITORY.CONNECTION_ERROR',
    title: 'Repository connection failed',
    category: 'infrastructure',
    retryable: true,
  } as const satisfies DomainError,

  VALIDATION_ERROR: {
    code: 'REPOSITORY.VALIDATION_ERROR',
    title: 'Entity validation failed',
    category: 'validation',
    retryable: false,
  } as const satisfies DomainError,

  MAPPING_ERROR: {
    code: 'REPOSITORY.MAPPING_ERROR',
    title: 'Data mapping failed',
    category: 'validation',
    retryable: false,
  } as const satisfies DomainError,
} as const;

/**
 * Helper functions to create repository errors with context
 */
export const RepositoryErrorFactory = {
  concurrencyConflict(
    expectedRevision: number,
    actualRevision: number,
  ): DomainError {
    return {
      ...RepositoryErrors.CONCURRENCY_CONFLICT,
      detail: `Expected revision ${expectedRevision}, but found ${actualRevision}`,
      context: { expectedRevision, actualRevision },
    };
  },

  notFound(entityType: string, id: string): DomainError {
    return {
      ...RepositoryErrors.NOT_FOUND,
      detail: `${entityType} with id '${id}' not found`,
      context: { entityType, id },
    };
  },

  connectionError(details: string): DomainError {
    return {
      ...RepositoryErrors.CONNECTION_ERROR,
      detail: `Repository connection failed: ${details}`,
      context: { details },
    };
  },

  validationError(field: string, message: string): DomainError {
    return {
      ...RepositoryErrors.VALIDATION_ERROR,
      detail: `Validation failed for ${field}: ${message}`,
      context: { field, message },
    };
  },

  mappingError(field: string, message: string): DomainError {
    return {
      ...RepositoryErrors.MAPPING_ERROR,
      detail: `Data mapping failed for ${field}: ${message}`,
      context: { field, message },
    };
  },
};

// Export type for backward compatibility with class-based approach
export type RepositoryError = DomainError;
