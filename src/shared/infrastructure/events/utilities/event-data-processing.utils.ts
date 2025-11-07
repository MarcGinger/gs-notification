/**
 * Shared Event Data Processing Utilities
 *
 * Provides common utilities for processing event data from EventStore and other sources.
 * These utilities handle type conversions, safe field extraction, and data normalization
 * that can be reused across all bounded contexts.
 *
 * @domain Shared Infrastructure - Event Data Processing
 * @layer Infrastructure
 * @pattern Utility Pattern
 */
export class EventDataProcessingUtils {
  /**
   * Safely extract string field from event data
   *
   * @param data - Source data object
   * @param fieldName - Name of the field to extract
   * @param defaultValue - Default value if field is missing or invalid
   * @returns String value or default
   */
  static extractString(
    data: Record<string, unknown>,
    fieldName: string,
    defaultValue?: string,
  ): string | undefined {
    const value = data[fieldName];
    if (typeof value === 'string') {
      return value;
    }
    return defaultValue;
  }

  /**
   * Safely extract number field from event data with conversion
   *
   * Handles both string and number representations.
   *
   * @param data - Source data object
   * @param fieldName - Name of the field to extract
   * @param defaultValue - Default value if field is missing or invalid
   * @returns Number value or default
   */
  static extractNumber(
    data: Record<string, unknown>,
    fieldName: string,
    defaultValue?: number,
  ): number | undefined {
    const value = data[fieldName];

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return defaultValue;
  }

  /**
   * Safely extract Date field from event data with conversion
   *
   * Handles both string (ISO format) and Date object representations.
   *
   * @param data - Source data object
   * @param fieldName - Name of the field to extract
   * @param defaultValue - Default value if field is missing or invalid
   * @returns Date value or default
   */
  static extractDate(
    data: Record<string, unknown>,
    fieldName: string,
    defaultValue?: Date,
  ): Date | undefined {
    const value = data[fieldName];

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return defaultValue;
  }

  /**
   * Safely extract boolean field from event data with conversion
   *
   * Handles boolean, string, and number representations.
   *
   * @param data - Source data object
   * @param fieldName - Name of the field to extract
   * @param defaultValue - Default value if field is missing or invalid
   * @returns Boolean value or default
   */
  static extractBoolean(
    data: Record<string, unknown>,
    fieldName: string,
    defaultValue?: boolean,
  ): boolean | undefined {
    const value = data[fieldName];

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return defaultValue;
  }

  /**
   * Extract version field with proper conversion and validation
   *
   * Handles both string and number representations, ensures positive integer.
   *
   * @param data - Source data object
   * @param fieldName - Name of the version field (defaults to 'version')
   * @param defaultValue - Default version if field is missing or invalid
   * @returns Version number or default
   */
  static extractVersion(
    data: Record<string, unknown>,
    fieldName: string = 'version',
    defaultValue: number = 1,
  ): number {
    const version = this.extractNumber(data, fieldName, defaultValue);
    return version && version > 0 ? version : defaultValue;
  }

  /**
   * Extract timestamp fields (createdAt, updatedAt) with proper conversion
   *
   * @param data - Source data object
   * @returns Object with createdAt and updatedAt dates
   */
  static extractTimestamps(data: Record<string, unknown>): {
    createdAt: Date;
    updatedAt: Date;
  } {
    const now = new Date();
    const createdAt = this.extractDate(data, 'createdAt', now);
    const updatedAt = this.extractDate(data, 'updatedAt', createdAt || now);

    return {
      createdAt: createdAt!,
      updatedAt: updatedAt!,
    };
  }

  /**
   * Extract common aggregate fields (id, version, timestamps)
   *
   * @param data - Source data object
   * @returns Object with common aggregate fields
   */
  static extractCommonAggregateFields(data: Record<string, unknown>): {
    id: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    const id = this.extractString(data, 'id');
    if (!id) {
      throw new Error('Missing required field: id');
    }

    const version = this.extractVersion(data);
    const { createdAt, updatedAt } = this.extractTimestamps(data);

    return {
      id,
      version,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Batch extract multiple string fields
   *
   * @param data - Source data object
   * @param fieldNames - Array of field names to extract
   * @returns Map of field names to string values (only successful extractions)
   */
  static extractMultipleStrings(
    data: Record<string, unknown>,
    fieldNames: string[],
  ): Map<string, string> {
    const results = new Map<string, string>();

    for (const fieldName of fieldNames) {
      const value = this.extractString(data, fieldName);
      if (value !== undefined) {
        results.set(fieldName, value);
      }
    }

    return results;
  }

  /**
   * Safely extract typed enum field from event data
   *
   * @param data - Source data object
   * @param fieldName - Name of the field to extract
   * @param validValues - Array of valid enum values
   * @param defaultValue - Default value if field is missing or invalid
   * @returns Typed enum value or default
   */
  static extractEnum<T extends string>(
    data: Record<string, unknown>,
    fieldName: string,
    validValues: readonly T[],
    defaultValue?: T,
  ): T | undefined {
    const value = this.extractString(data, fieldName);

    if (value && validValues.includes(value as T)) {
      return value as T;
    }

    return defaultValue;
  }

  /**
   * Check if data contains all required fields
   *
   * @param data - Source data object
   * @param requiredFields - Array of required field names
   * @returns Object with validation result and missing fields
   */
  static validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: string[],
  ): {
    isValid: boolean;
    missingFields: string[];
  } {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }
}
