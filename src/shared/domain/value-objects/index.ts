/**
 * Shared Value Object Factory Functions
 *
 * This module provides factory functions for creating consistent, validated
 * value objects across all domains. Each factory generates a value object
 * class with built-in validation, normalization, and operations.
 *
 * Usage:
 * ```typescript
 * import { createStringVO } from 'src/shared/domain/value-objects';
 *
 * export const ProductName = createStringVO({
 *   name: 'ProductName',
 *   maxLength: 100,
 *   trim: true,
 *   errors: ProductErrors.Name
 * });
 * ```
 */

// Export all factory functions
export {
  createStringVO,
  createStringVOErrors,
  createEnhancedStringVOErrors,
  type StringVOInstance,
  type StringCase,
  type StringRefinement,
} from './string.vo';
export {
  createIntegerVO,
  createIntegerVOErrors,
  type IntegerVOInstance,
  type IntegerRefinement,
} from './integer.vo';
export {
  createBigIntVO,
  createBigIntVOErrors,
  type BigIntVOInstance,
  type BigIntRefinement,
} from './bigint.vo';
export {
  createCollectionVO,
  createCollectionVOErrors,
  type CollectionItemVO,
  type CollectionVOConfig,
  type CollectionVOInstance,
  type CollectionRefinement,
  type CollectionBusinessMethod,
} from './collection.vo';
export {
  createBooleanVO,
  createBooleanVOErrors,
  type BooleanVOInstance,
  type BooleanRefinement,
} from './boolean.vo';
export {
  createDateVO,
  createDateVOErrors,
  type DateVOInstance,
  type DateRefinement,
} from './date.vo';
export {
  createDecimalVO,
  createDecimalVOErrors,
  type DecimalVOInstance,
  type DecimalRefinement,
} from './decimal.vo';
export {
  createDateTimeVO,
  createDateTimeVOErrors,
  type DateTimeVOInstance,
  type DateTimeRefinement,
} from './datetime.vo';
export {
  createTimeVO,
  createTimeVOErrors,
  type TimeVOInstance,
  type TimeRefinement,
} from './time.vo';
export {
  createDurationVO,
  createDurationVOErrors,
  parseDuration,
  type DurationVOInstance,
  type DurationVORefinements,
  type DurationVOErrors,
  type DurationVOConfig,
} from './duration.vo';
export {
  createEnumVO,
  createEnumVOErrors,
  createEnhancedEnumVOErrors,
  createStateTransitions,
  createEnumTypeGuards,
  createDisplayNameHelper,
  type EnumVOInstance,
  type EnumRefinement,
  type StateTransitions,
} from './enum.vo';
export {
  createMoneyVO,
  createMoneyVOErrors,
  type MoneyVOInstance,
  type MoneyRefinement,
  CURRENCIES,
  type CurrencyCode,
} from './money.vo';
export {
  createUuidVO,
  createUuidVOErrors,
  type UuidVOInstance,
  type UuidRefinement,
} from './uuid.vo';

export {
  createRecordVO,
  createRecordVOErrors,
  type RecordVOInstance,
  type RecordRefinement,
} from './record.vo';

// Export common types
export type { Result } from '../../errors';
