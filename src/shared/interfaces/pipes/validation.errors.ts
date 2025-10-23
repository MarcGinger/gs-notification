import { makeCatalog, DomainError } from '../../errors';

const ValidationErrorDefinitions = {
  INVALID_VALUE: {
    title: 'Invalid value',
    detail: 'The provided value is invalid',
    category: 'validation' as const,
    retryable: false,
  },

  IDEMPOTENCY_KEY_TOO_LONG: {
    title: 'Idempotency key too long',
    detail: 'Idempotency key must not exceed maximum length',
    category: 'validation' as const,
    retryable: false,
  },

  IDEMPOTENCY_KEY_INVALID_CHARACTERS: {
    title: 'Idempotency key contains invalid characters',
    detail: 'Idempotency key contains control or disallowed characters',
    category: 'validation' as const,
    retryable: false,
  },
} as const;

export const ValidationErrors = makeCatalog(
  ValidationErrorDefinitions,
  'VALIDATION',
) as {
  INVALID_VALUE: DomainError<'VALIDATION.INVALID_VALUE'>;
  IDEMPOTENCY_KEY_TOO_LONG: DomainError<'VALIDATION.IDEMPOTENCY_KEY_TOO_LONG'>;
  IDEMPOTENCY_KEY_INVALID_CHARACTERS: DomainError<'VALIDATION.IDEMPOTENCY_KEY_INVALID_CHARACTERS'>;
};
