import { deepEqual } from '../../utilities/deep-equal';

/**
 * Generic helper for comparing simple fields in change sets
 *
 * @param before - The value before the change
 * @param after - The value after the change
 * @param fieldName - The name of the field being compared
 * @param changeSet - The change set object to update
 * @returns void - Updates the changeSet in place
 * TODO REMOVE
 */

export function compareField<T>(
  before: T,
  after: T,
  fieldName: string,
  changeSet: Record<string, any>,
): void {
  if (before !== after) {
    changeSet[fieldName] = {
      old: before,
      new: after,
    };
  }
}

/**
 * Generic helper for comparing complex fields using deep equality
 *
 * @param before - The value before the change
 * @param after - The value after the change
 * @param fieldName - The name of the field being compared
 * @param changeSet - The change set object to update
 * @returns void - Updates the changeSet in place
 * TODO REMOVE
 */
export function compareComplexField<T>(
  before: T,
  after: T,
  fieldName: string,
  changeSet: Record<string, any>,
): void {
  if (!deepEqual(before, after)) {
    changeSet[fieldName] = {
      old: before,
      new: after,
    };
  }
}
