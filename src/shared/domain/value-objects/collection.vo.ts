import { Result, ok, err, DomainError } from '../../errors';

/**
 * Base interface for value objects that can be used in collections
 */
export interface CollectionItemVO<T = unknown> {
  readonly value: T;
  equals(other: CollectionItemVO<T>): boolean;
}

/**
 * Creates standardized error factory functions for collection value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend
 * @param entityName - Human-readable name for the entity (e.g., 'Channel Codes', 'Rail Codes')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createCollectionVOErrors } from 'src/shared/domain/value-objects/collection.vo';
 * import { ProductErrors } from '../errors/product.errors';
 *
 * export const ProductTags = createCollectionVO({
 *   name: 'ProductTags',
 *   itemName: 'ProductTag',
 *   maxCount: 10,
 *   allowEmpty: false,
 *   allowDuplicates: false,
 *   itemFactory: ProductTag,
 *   errors: createCollectionVOErrors(ProductErrors.INVALID_TAGS, 'Product Tags'),
 * });
 * ```
 */
export function createCollectionVOErrors<TPrimitive>(
  baseError: DomainError,
  entityName: string,
) {
  return {
    empty: () => ({
      ...baseError,
      detail: `${entityName} cannot be empty`,
      context: { operation: 'empty_check' },
    }),

    tooMany: (count: number, max: number) => ({
      ...baseError,
      detail: `${entityName} cannot exceed ${max} items`,
      context: { count, maxAllowed: max, operation: 'count_check' },
    }),

    duplicates: (duplicateCount: number) => ({
      ...baseError,
      detail: `${entityName} cannot contain duplicates`,
      context: {
        duplicatesFound: duplicateCount,
        operation: 'duplicate_check',
      },
    }),

    notFound: (item: TPrimitive) => ({
      ...baseError,
      detail: `Item not found in ${entityName}`,
      context: { item, operation: 'find_check' },
    }),

    alreadyExists: (item: TPrimitive) => ({
      ...baseError,
      detail: `Item already exists in ${entityName}`,
      context: { item, operation: 'exists_check' },
    }),

    cannotRemoveLast: (item: TPrimitive) => ({
      ...baseError,
      detail: `Cannot remove last item from ${entityName}. At least one is required.`,
      context: { item, operation: 'remove_check' },
    }),

    invalidItem: (value: unknown, reason: string) => ({
      ...baseError,
      detail: `Invalid item for ${entityName}: ${reason}`,
      context: { value, reason, operation: 'item_validation' },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: { operation: 'required_check' },
    }),

    custom: (value: unknown[], reason: string) => ({
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value,
        reason,
        operation: 'custom_validation',
      },
    }),
  };
}

/**
 * Business rule refinement for collection-level validation
 */
export interface CollectionRefinement<TItem extends CollectionItemVO> {
  /** Name of the refinement rule (for debugging and error context) */
  name: string;
  /** Test function that returns true if the collection passes the rule */
  test: (items: TItem[]) => boolean;
  /** Error factory function called when the test fails */
  createError: (items: TItem[]) => DomainError;
}

/**
 * Business method definition for domain-specific collection queries
 */
export interface CollectionBusinessMethod<TItem extends CollectionItemVO> {
  /** Name of the method (will become a method on the collection class) */
  name: string;
  /** Implementation function that operates on the collection items */
  implementation: (items: TItem[]) => boolean | number | string | TItem[];
}

/**
 * Configuration interface for collection value objects
 */
export interface CollectionVOConfig<
  TPrimitive,
  TItem extends CollectionItemVO<TPrimitive>,
> {
  /** Name of the collection (for error messages and serialization) */
  name: string;
  /** Name of individual items (for error messages) */
  itemName: string;
  /** Factory function to create individual value objects */
  itemFactory: {
    create: (value: TPrimitive) => Result<TItem, DomainError>;
  };
  /** Allow empty collections */
  allowEmpty?: boolean;
  /** Allow duplicate items in the collection */
  allowDuplicates?: boolean;
  /** Minimum collection size */
  minCount?: number;
  /** Maximum collection size */
  maxCount?: number;
  /** Whether the collection is required */
  required?: boolean;
  /** Business rule refinements for collection-level validation */
  refinements?: CollectionRefinement<TItem>[];
  /** Domain-specific business methods */
  businessMethods?: CollectionBusinessMethod<TItem>[];
  /** Domain-specific error factory functions */
  errors: {
    empty: () => DomainError;
    tooMany: (count: number, max: number) => DomainError;
    duplicates: (duplicateCount: number) => DomainError;
    notFound: (item: TPrimitive) => DomainError;
    alreadyExists: (item: TPrimitive) => DomainError;
    cannotRemoveLast: (item: TPrimitive) => DomainError;
    invalidItem: (value: unknown, reason: string) => DomainError;
    required: () => DomainError;
  };
}

/**
 * Instance type for collection value objects
 */
export interface CollectionVOInstance<
  TPrimitive,
  TItem extends CollectionItemVO<TPrimitive>,
> {
  readonly items: readonly TItem[];
  readonly size: number;
  readonly isEmpty: boolean;
  contains(item: TItem): boolean;
  containsValue(value: TPrimitive): boolean;
  add(
    item: TItem,
  ): Result<CollectionVOInstance<TPrimitive, TItem>, DomainError>;
  remove(
    item: TItem,
  ): Result<CollectionVOInstance<TPrimitive, TItem>, DomainError>;
  toArray(): TPrimitive[];
  equals(other: CollectionVOInstance<TPrimitive, TItem>): boolean;
  compare(other: CollectionVOInstance<TPrimitive, TItem>): -1 | 0 | 1;
  toString(): string;
  toJSON(): { items: TPrimitive[]; type: string };
}

/**
 * Generic factory function to create collection-based value objects
 * Provides consistent validation, operations, and business methods for any primitive type
 *
 * @param config Configuration object defining validation rules and business methods
 * @returns Collection value object class with validation and operations
 */
export function createCollectionVO<
  TPrimitive,
  TItem extends CollectionItemVO<TPrimitive>,
>(config: CollectionVOConfig<TPrimitive, TItem>) {
  // Configuration with defaults
  const ALLOW_EMPTY = config.allowEmpty ?? false;
  const ALLOW_DUPLICATES = config.allowDuplicates ?? false;
  const MIN_COUNT = config.minCount ?? (ALLOW_EMPTY ? 0 : 1);
  const MAX_COUNT = config.maxCount ?? Number.MAX_SAFE_INTEGER;
  const REQUIRED = config.required ?? false;

  /**
   * Validate collection against configuration rules
   */
  const validate = (items: TItem[]): Result<TItem[], DomainError> => {
    // Empty check
    if (!ALLOW_EMPTY && items.length === 0) {
      return err(config.errors.empty());
    }

    // Minimum count check
    if (items.length < MIN_COUNT) {
      return err(config.errors.empty());
    }

    // Maximum count check
    if (items.length > MAX_COUNT) {
      return err(config.errors.tooMany(items.length, MAX_COUNT));
    }

    // Duplicate check
    if (!ALLOW_DUPLICATES) {
      const uniqueValues = new Set(items.map((item) => item.value));
      if (uniqueValues.size !== items.length) {
        return err(config.errors.duplicates(items.length - uniqueValues.size));
      }
    }

    // Collection refinements validation (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(items)) {
          return err(refinement.createError(items));
        }
      }
    }

    return ok(items);
  };

  /**
   * Generic Collection Value Object implementation
   * Generated dynamically based on configuration
   */
  return class CollectionVO implements CollectionVOInstance<TPrimitive, TItem> {
    public readonly _items: TItem[];

    private constructor(items: TItem[]) {
      this._items = items;

      // Dynamically add business methods
      if (config.businessMethods) {
        for (const method of config.businessMethods) {
          // Add method to instance dynamically with proper typing
          Object.defineProperty(this, method.name, {
            value: () => method.implementation(this._items),
            writable: false,
            enumerable: true,
            configurable: false,
          });
        }
      }
    }

    /**
     * Create collection from array of primitive values with validation
     */
    static create(
      values?: TPrimitive[] | null,
    ): Result<CollectionVO, DomainError> {
      // Check if collection is required but not provided
      if (REQUIRED && (values === undefined || values === null)) {
        return err(config.errors.required());
      }

      // If not required and no values provided, return error for type safety
      if (values === undefined || values === null) {
        return err(config.errors.empty());
      }

      // Create individual value objects
      const itemResults = values.map((value) =>
        config.itemFactory.create(value),
      );
      const failedItem = itemResults.find((result) => !result.ok);
      if (failedItem) {
        return err((failedItem as { ok: false; error: DomainError }).error);
      }

      const items = itemResults
        .filter((result) => result.ok)
        .map((result) => (result as { ok: true; value: TItem }).value);

      const validationResult = validate(items);
      if (validationResult.ok) {
        return ok(new CollectionVO(validationResult.value));
      } else {
        return err(
          (validationResult as { ok: false; error: DomainError }).error,
        );
      }
    }

    /**
     * Create collection from existing value objects
     */
    static fromValueObjects(items: TItem[]): Result<CollectionVO, DomainError> {
      const validationResult = validate(items);
      if (validationResult.ok) {
        return ok(new CollectionVO(validationResult.value));
      } else {
        return err(
          (validationResult as { ok: false; error: DomainError }).error,
        );
      }
    }

    /**
     * Create collection from unknown value with type coercion
     * Attempts to convert unknown input to array of primitives
     */
    static from(value: unknown): Result<CollectionVO, DomainError> {
      // Check if collection is required but not provided
      if (REQUIRED && (value === undefined || value === null)) {
        return err(config.errors.required());
      }

      // Handle null/undefined
      if (value == null) {
        return ALLOW_EMPTY
          ? CollectionVO.create([])
          : err(config.errors.empty());
      }

      // Handle arrays
      if (Array.isArray(value)) {
        return CollectionVO.create(value as TPrimitive[]);
      }

      // For non-array values, return error instead of auto-converting
      // This prevents objects from being wrapped as single-item arrays
      return err(
        config.errors.invalidItem(
          value,
          'Input must be an array, not ' + typeof value,
        ),
      );
    }

    // ==================== Accessors ====================

    /** Get readonly array of items */
    get items(): readonly TItem[] {
      return Object.freeze([...this._items]);
    }

    /** Get collection size */
    get size(): number {
      return this._items.length;
    }

    /** Check if collection is empty */
    get isEmpty(): boolean {
      return this._items.length === 0;
    }

    // ==================== Collection Operations ====================

    /**
     * Check if collection contains specific item
     */
    contains(item: TItem): boolean {
      return this._items.some((i) => i.equals(item));
    }

    /**
     * Check if collection contains item with specific value
     */
    containsValue(value: TPrimitive): boolean {
      return this._items.some((i) => i.value === value);
    }

    /**
     * Add item to collection (returns new collection)
     */
    add(item: TItem): Result<CollectionVO, DomainError> {
      if (!ALLOW_DUPLICATES && this.contains(item)) {
        return err(config.errors.alreadyExists(item.value));
      }

      if (this._items.length >= MAX_COUNT) {
        return err(config.errors.tooMany(this._items.length + 1, MAX_COUNT));
      }

      return CollectionVO.create([
        ...this._items.map((i) => i.value),
        item.value,
      ]);
    }

    /**
     * Remove item from collection (returns new collection)
     */
    remove(item: TItem): Result<CollectionVO, DomainError> {
      const filtered = this._items.filter((i) => !i.equals(item));

      if (filtered.length === this._items.length) {
        return err(config.errors.notFound(item.value));
      }

      if (filtered.length < MIN_COUNT) {
        return err(config.errors.cannotRemoveLast(item.value));
      }

      return CollectionVO.fromValueObjects(filtered);
    }

    // ==================== Conversion ====================

    /**
     * Convert to array of primitive values
     */
    toArray(): TPrimitive[] {
      return this._items.map((item) => item.value);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another collection
     */
    equals(other: CollectionVO): boolean {
      if (this._items.length !== other._items.length) return false;
      return this._items.every((item) => other.contains(item));
    }

    /**
     * Compare with another collection (by length, then lexicographically)
     */
    compare(other: CollectionVO): -1 | 0 | 1 {
      if (this._items.length < other._items.length) return -1;
      if (this._items.length > other._items.length) return 1;

      // Same length - compare items lexicographically
      const thisStr = this.toString();
      const otherStr = other.toString();
      if (thisStr < otherStr) return -1;
      if (thisStr > otherStr) return 1;
      return 0;
    }

    // ==================== Serialization ====================

    /**
     * Convert to string representation
     */
    toString(): string {
      return `${config.name}[${this._items.map((i) => i.value).join(', ')}]`;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { items: TPrimitive[]; type: string } {
      return {
        items: this.toArray(),
        type: config.name,
      };
    }
  };
}

// Convenience type aliases for common use cases
export type StringCollectionVO<TItem extends CollectionItemVO<string>> =
  CollectionVOInstance<string, TItem>;

export type IntegerCollectionVO<TItem extends CollectionItemVO<number>> =
  CollectionVOInstance<number, TItem>;

// Re-export convenience factory functions for backward compatibility
export const createStringCollectionVO = <
  TItem extends CollectionItemVO<string>,
>(
  config: CollectionVOConfig<string, TItem>,
) => createCollectionVO(config);

export const createIntegerCollectionVO = <
  TItem extends CollectionItemVO<number>,
>(
  config: CollectionVOConfig<number, TItem>,
) => createCollectionVO(config);

// Re-export convenience error factory functions
export const createStringCollectionVOErrors = (
  baseError: DomainError,
  entityName: string,
) => createCollectionVOErrors<string>(baseError, entityName);

export const createIntegerCollectionVOErrors = (
  baseError: DomainError,
  entityName: string,
) => createCollectionVOErrors<number>(baseError, entityName);
