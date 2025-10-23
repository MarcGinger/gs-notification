/**
 * Field Extraction Utilities
 *
 * Utilities for extracting field names from objects for field-level authorization,
 * validation, and other operations that need to know which fields are being modified.
 */

/**
 * Extract field names from an object that have defined values (not undefined)
 *
 * @param obj - The object to extract field names from
 * @returns Array of field names that are defined (not undefined) in the object
 *
 * @example
 * ```typescript
 * const props = { name: 'John', age: undefined, city: 'New York' };
 * const fields = extractDefinedFields(props);
 * // Result: ['name', 'city']
 * ```
 */
export function extractDefinedFields<T extends Record<string, any>>(
  obj: T,
): Array<keyof T> {
  return Object.keys(obj).filter((key) => obj[key] !== undefined) as Array<
    keyof T
  >;
}

/**
 * Extract field names from an object that have truthy values
 *
 * @param obj - The object to extract field names from
 * @returns Array of field names that have truthy values in the object
 *
 * @example
 * ```typescript
 * const props = { name: 'John', age: 0, active: true, description: null };
 * const fields = extractTruthyFields(props);
 * // Result: ['name', 'active']
 * ```
 */
export function extractTruthyFields<T extends Record<string, any>>(
  obj: T,
): Array<keyof T> {
  return Object.keys(obj).filter((key) => Boolean(obj[key])) as Array<keyof T>;
}

/**
 * Extract field names from an object that have changed values compared to original
 *
 * @param updated - The updated object
 * @param original - The original object to compare against
 * @returns Array of field names that have changed values
 *
 * @example
 * ```typescript
 * const original = { name: 'John', age: 30, city: 'NYC' };
 * const updated = { name: 'John', age: 31, city: 'NYC' };
 * const changed = extractChangedFields(updated, original);
 * // Result: ['age']
 * ```
 */
export function extractChangedFields<T extends Record<string, any>>(
  updated: T,
  original: Partial<T>,
): Array<keyof T> {
  return Object.keys(updated).filter((key) => {
    return updated[key] !== undefined && updated[key] !== original[key];
  }) as Array<keyof T>;
}

/**
 * Extract field names from an object using a custom predicate function
 *
 * @param obj - The object to extract field names from
 * @param predicate - Function to test each field value
 * @returns Array of field names that pass the predicate test
 *
 * @example
 * ```typescript
 * const props = { name: 'John', age: 30, salary: 50000 };
 * const numericFields = extractFieldsByPredicate(props, (value) => typeof value === 'number');
 * // Result: ['age', 'salary']
 * ```
 */
export function extractFieldsByPredicate<T extends Record<string, any>>(
  obj: T,
  predicate: (value: any, key: keyof T) => boolean,
): Array<keyof T> {
  return Object.keys(obj).filter((key) =>
    predicate(obj[key], key as keyof T),
  ) as Array<keyof T>;
}

/**
 * Type-safe field extraction with explicit field mapping
 *
 * Useful when you want to ensure compile-time checking of field names
 * and provide explicit mapping for nested or computed fields.
 *
 * @param obj - The object to extract field names from
 * @param fieldMap - Mapping of property keys to field names
 * @returns Array of field names based on the mapping
 *
 * @example
 * ```typescript
 * interface UpdateProps {
 *   userName: string;
 *   userAge: number;
 *   isActive: boolean;
 * }
 *
 * const fieldMap: Record<keyof UpdateProps, string> = {
 *   userName: 'name',
 *   userAge: 'age',
 *   isActive: 'active'
 * };
 *
 * const props = { userName: 'John', isActive: true };
 * const fields = extractMappedFields(props, fieldMap);
 * // Result: ['name', 'active']
 * ```
 */
export function extractMappedFields<T extends Record<string, any>>(
  obj: T,
  fieldMap: Record<keyof T, string>,
): string[] {
  return Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .map((key) => fieldMap[key as keyof T])
    .filter((mappedField) => mappedField !== undefined);
}

/**
 * Extract nested field paths for complex objects
 *
 * @param obj - The object to extract field paths from
 * @param prefix - Optional prefix for nested paths
 * @returns Array of dot-notation field paths
 *
 * @example
 * ```typescript
 * const props = {
 *   name: 'John',
 *   address: { city: 'NYC', country: 'USA' },
 *   tags: ['admin', 'user']
 * };
 * const paths = extractNestedFieldPaths(props);
 * // Result: ['name', 'address.city', 'address.country', 'tags']
 * ```
 */
export function extractNestedFieldPaths(
  obj: Record<string, any>,
  prefix: string = '',
): string[] {
  const paths: string[] = [];

  Object.keys(obj).forEach((key) => {
    const value: unknown = obj[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (value !== undefined) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.constructor === Object
      ) {
        // Recursively extract from nested objects
        paths.push(
          ...extractNestedFieldPaths(value as Record<string, any>, currentPath),
        );
      } else {
        // Add the field path
        paths.push(currentPath);
      }
    }
  });

  return paths;
}
