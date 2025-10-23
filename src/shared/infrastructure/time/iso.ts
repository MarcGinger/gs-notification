// Strict ISO-8601 UTC parsing utilities.
// Accepts only the form: 2025-08-16T10:00:00.000Z or without milliseconds.
import { DomainError, Result, ok, err, withContext } from '../../errors';

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * ISO Date Parsing Error Definitions
 * Defines all errors that can occur during ISO date parsing operations
 */
const IsoDateErrorDefinitions = {
  INVALID_FORMAT: {
    title: 'Invalid ISO Date Format',
    detail: 'Date string does not match required ISO-8601 UTC format',
    category: 'validation' as const,
    retryable: false,
  },

  INVALID_DATE_VALUE: {
    title: 'Invalid Date Value',
    detail: 'Date string format is correct but represents an invalid date',
    category: 'validation' as const,
    retryable: false,
  },
} as const;

/**
 * ISO date parsing error catalog with namespaced error codes
 */
const IsoDateErrors = Object.fromEntries(
  Object.entries(IsoDateErrorDefinitions).map(([key, errorDef]) => {
    const code = `ISO_DATE.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof IsoDateErrorDefinitions]: DomainError<`ISO_DATE.${Extract<K, string>}`>;
};

/**
 * Parses an ISO-8601 UTC date string with strict validation
 * @param date - ISO-8601 UTC formatted date string
 * @returns Result with Date on success, DomainError on failure
 */
export const parseIsoUtcStrictSafe = (
  date: string,
): Result<Date, DomainError> => {
  // Validate format against ISO-8601 UTC pattern
  if (!ISO_8601_UTC.test(date)) {
    return err(
      withContext(IsoDateErrors.INVALID_FORMAT, {
        operation: 'parseIsoUtcStrictSafe',
        input: { date },
        expectedFormat: 'YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ',
      }),
    );
  }

  // Parse the date and validate it represents a real date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return err(
      withContext(IsoDateErrors.INVALID_DATE_VALUE, {
        operation: 'parseIsoUtcStrictSafe',
        input: { date },
        parsedValue: parsed.toString(),
      }),
    );
  }

  return ok(parsed);
};
