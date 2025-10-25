/**
 * Simple utilities for safely accessing value object properties
 * Eliminates the need for 'as any' casting across the codebase
 */

/**
 * Safely get an array from a collection value object
 */
export const getVOArray = <T>(valueObject: unknown): T[] => {
  if (
    valueObject &&
    typeof valueObject === 'object' &&
    'toArray' in valueObject &&
    typeof (valueObject as Record<string, unknown>).toArray === 'function'
  ) {
    return ((valueObject as Record<string, unknown>).toArray as () => T[])();
  }
  return [];
};

/**
 * Safely get a value from a simple value object
 */
export const getVOValue = <T>(valueObject: unknown): T | undefined => {
  if (
    valueObject &&
    typeof valueObject === 'object' &&
    'value' in valueObject
  ) {
    return (valueObject as Record<string, unknown>).value as T;
  }
  return undefined;
};

/**
 * Safely get a property from a record value object
 */
export const getVOProperty = <T>(
  recordVO: unknown,
  propertyName: string,
): T | undefined => {
  if (
    recordVO &&
    typeof recordVO === 'object' &&
    'value' in recordVO &&
    typeof (recordVO as Record<string, unknown>).value === 'object' &&
    (recordVO as Record<string, unknown>).value !== null
  ) {
    const record = (recordVO as Record<string, unknown>).value as Record<
      string,
      unknown
    >;
    return record[propertyName] as T;
  }
  return undefined;
};

/**
 * Universal property extractor that handles both value objects and plain objects
 *
 * This function provides a unified way to extract properties from objects regardless
 * of whether they are domain value objects (with .value properties) or plain objects
 * (with direct property values).
 *
 * @param obj - The object to extract from (value object or plain object)
 * @param propertyName - The name of the property to extract
 * @returns The extracted value or undefined if not found
 *
 * @example
 * ```typescript
 * // Works with value objects
 * const name = extractPropertyValue(userVO, 'name'); // Extracts userVO.name.value
 *
 * // Works with plain objects
 * const name = extractPropertyValue(userObj, 'name'); // Extracts userObj.name
 * ```
 */
export const extractPropertyValue = <T>(
  obj: unknown,
  propertyName: string,
): T | undefined => {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const record = obj as Record<string, unknown>;

  // First try to extract as a value object using getVOProperty
  const voValue = getVOProperty<T>(obj, propertyName);
  if (voValue !== undefined) {
    return voValue;
  }

  // Fallback: try to get direct property value (for plain objects)
  return record[propertyName] as T | undefined;
};

/**
 * Universal property array extractor that handles both collection value objects and plain arrays
 *
 * This function combines extractPropertyValue and getVOArray to provide a unified way
 * to extract array properties from objects regardless of whether they are collection
 * value objects (with .toArray() methods) or plain arrays.
 *
 * @param obj - The object to extract from (value object or plain object)
 * @param propertyName - The name of the array property to extract
 * @returns The extracted array or empty array if not found
 *
 * @example
 * ```typescript
 * // Works with collection value objects
 * const items = extractPropertyArray<Item>(configVO, 'items'); // Extracts configVO.items.toArray()
 *
 * // Works with plain arrays
 * const items = extractPropertyArray<Item>(configObj, 'items'); // Extracts configObj.items
 * ```
 */
export const extractPropertyArray = <T>(
  obj: unknown,
  propertyName: string,
): T[] => {
  // First extract the property (could be a collection VO or plain array)
  const property = extractPropertyValue(obj, propertyName);

  if (!property) {
    return [];
  }

  // If it's already a plain array, return it
  if (Array.isArray(property)) {
    return property as T[];
  }

  // Otherwise, try to extract as a collection value object using getVOArray
  return getVOArray<T>(property);
};

/**
 * Compares two optional value objects for changes
 *
 * This utility function provides a standardized way to detect changes between
 * optional value objects that implement the equals() method. It handles all
 * the null/undefined edge cases properly.
 *
 * @param current - Current value object or undefined
 * @param newValue - New value object or undefined
 * @returns true if values are different, false if same
 *
 * @example
 * ```typescript
 * // Detecting changes in aggregates
 * if (hasValueChanged(this._entity.email, validatedFields.email)) {
 *   return true; // Email has changed
 * }
 *
 * // Works with all scenarios:
 * hasValueChanged(undefined, newEmail)     // true (adding value)
 * hasValueChanged(oldEmail, undefined)     // true (removing value)
 * hasValueChanged(oldEmail, newEmail)      // uses equals() method
 * hasValueChanged(undefined, undefined)    // false (no change)
 * ```
 */
export const hasValueChanged = <T extends { equals(other: T): boolean }>(
  current: T | undefined,
  newValue: T | undefined,
): boolean => {
  // One is undefined, other isn't
  if ((current === undefined) !== (newValue === undefined)) {
    return true;
  }
  // Both exist but values differ
  if (current && newValue && !newValue.equals(current)) {
    return true;
  }
  return false;
};
