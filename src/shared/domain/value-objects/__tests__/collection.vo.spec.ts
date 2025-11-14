/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  createCollectionVO,
  createCollectionVOErrors,
  CollectionItemVO,
} from '../collection.vo';
import { DomainError, isOk, isErr, Result } from '../../../errors';

// Mock item factory for testing
class MockStringItem implements CollectionItemVO<string> {
  constructor(public readonly value: string) {}

  equals(other: CollectionItemVO<string>): boolean {
    return this.value === other.value;
  }
}

const mockStringItemFactory = {
  create: (value: string): Result<MockStringItem, DomainError> => {
    if (typeof value !== 'string') {
      return {
        ok: false,
        error: {
          code: 'INVALID_ITEM',
          title: 'Invalid item',
          category: 'validation',
          detail: 'Item must be a string',
        } as DomainError,
      };
    }
    return { ok: true, value: new MockStringItem(value) };
  },
};

describe('CollectionVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'COLLECTION_TEST_ERROR',
    title: 'Collection test error',
    category: 'validation',
  };

  const mockErrors = createCollectionVOErrors<string>(
    mockBaseError,
    'Test Collection',
  );

  describe('Basic Creation', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should create collection with valid items', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = BasicCollectionVO.create(items);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const collection = result.value;
        expect(collection.size).toBe(3);
        expect(collection.isEmpty).toBe(false);
        expect(collection.toArray()).toEqual(items);
      }
    });

    it('should create empty collection when allowed', () => {
      const result = BasicCollectionVO.create([]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const collection = result.value;
        expect(collection.size).toBe(0);
        expect(collection.isEmpty).toBe(true);
        expect(collection.toArray()).toEqual([]);
      }
    });

    it('should reject null input', () => {
      const result = BasicCollectionVO.create(null);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot be empty');
      }
    });

    it('should reject undefined input', () => {
      const result = BasicCollectionVO.create(undefined);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot be empty');
      }
    });

    it('should handle required validation', () => {
      const RequiredCollectionVO = createCollectionVO({
        name: 'RequiredCollection',
        itemName: 'Item',
        itemFactory: mockStringItemFactory,
        required: true,
        allowEmpty: true,
        errors: mockErrors,
      });

      const result = RequiredCollectionVO.create(null);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('is required');
      }
    });
  });

  describe('Size Constraints', () => {
    const SizedCollectionVO = createCollectionVO({
      name: 'SizedCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      minCount: 2,
      maxCount: 5,
      allowEmpty: false,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should enforce minimum size constraints', () => {
      const result = SizedCollectionVO.create(['item1']);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot be empty');
      }
    });

    it('should enforce maximum size constraints', () => {
      const items = ['item1', 'item2', 'item3', 'item4', 'item5', 'item6'];
      const result = SizedCollectionVO.create(items);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot exceed 5 items');
      }
    });

    it('should accept collections within size limits', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = SizedCollectionVO.create(items);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(3);
      }
    });
  });

  describe('Uniqueness Constraints', () => {
    const UniqueCollectionVO = createCollectionVO({
      name: 'UniqueCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: false,
      errors: mockErrors,
    });

    it('should enforce uniqueness when configured', () => {
      const items = ['item1', 'item2', 'item1'];
      const result = UniqueCollectionVO.create(items);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot contain duplicates');
      }
    });

    it('should accept unique items', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = UniqueCollectionVO.create(items);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(3);
      }
    });

    it('should allow duplicates when configured', () => {
      const DuplicateCollectionVO = createCollectionVO({
        name: 'DuplicateCollection',
        itemName: 'Item',
        itemFactory: mockStringItemFactory,
        allowEmpty: true,
        allowDuplicates: true,
        errors: mockErrors,
      });

      const items = ['item1', 'item2', 'item1'];
      const result = DuplicateCollectionVO.create(items);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(3);
      }
    });
  });

  describe('Type Coercion (from method)', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should create collection from array', () => {
      const result = BasicCollectionVO.from(['item1', 'item2']);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(2);
      }
    });

    it('should reject non-array input with error', () => {
      const result = BasicCollectionVO.from('single-item');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('Input must be an array');
      }
    });

    it('should reject object input with error', () => {
      const objectInput = {
        key1: 'value1',
        key2: 'value2',
      };
      const result = BasicCollectionVO.from(objectInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain(
          'Input must be an array, not object',
        );
      }
    });

    it('should handle null input based on configuration', () => {
      const result = BasicCollectionVO.from(null);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(0);
      }
    });
  });

  describe('Collection Operations', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    let collection: any;

    beforeEach(() => {
      const result = BasicCollectionVO.create(['item1', 'item2', 'item3']);
      if (isOk(result)) {
        collection = result.value;
      }
    });

    it('should check if collection contains item', () => {
      const item = new MockStringItem('item2');
      expect(collection.contains(item)).toBe(true);

      const nonExistentItem = new MockStringItem('item4');
      expect(collection.contains(nonExistentItem)).toBe(false);
    });

    it('should check if collection contains value', () => {
      expect(collection.containsValue('item2')).toBe(true);
      expect(collection.containsValue('item4')).toBe(false);
    });

    it('should add item to collection', () => {
      const newItem = new MockStringItem('item4');
      const result = collection.add(newItem);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect((result.value as any).size).toBe(4);
        expect((result.value as any).contains(newItem)).toBe(true);
      }
    });

    it('should remove item from collection', () => {
      const itemToRemove = new MockStringItem('item2');
      const result = collection.remove(itemToRemove);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect((result.value as any).size).toBe(2);
        expect((result.value as any).contains(itemToRemove)).toBe(false);
      }
    });

    it('should reject adding duplicate when duplicates not allowed', () => {
      const UniqueCollectionVO = createCollectionVO({
        name: 'UniqueCollection',
        itemName: 'Item',
        itemFactory: mockStringItemFactory,
        allowEmpty: true,
        allowDuplicates: false,
        errors: mockErrors,
      });

      const uniqueResult = UniqueCollectionVO.create(['item1', 'item2']);
      if (isOk(uniqueResult)) {
        const duplicateItem = new MockStringItem('item1');
        const addResult = uniqueResult.value.add(duplicateItem);

        expect(isErr(addResult)).toBe(true);
        if (isErr(addResult)) {
          expect(addResult.error.detail).toContain('already exists');
        }
      }
    });

    it('should reject removing non-existent item', () => {
      const nonExistentItem = new MockStringItem('item4');
      const result = collection.remove(nonExistentItem);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('not found');
      }
    });
  });

  describe('Comparison Operations', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should check equality correctly', () => {
      const collection1 = BasicCollectionVO.create(['a', 'b', 'c']);
      const collection2 = BasicCollectionVO.create(['a', 'b', 'c']);
      const collection3 = BasicCollectionVO.create(['a', 'b', 'd']);

      if (isOk(collection1) && isOk(collection2) && isOk(collection3)) {
        expect(collection1.value.equals(collection2.value)).toBe(true);
        expect(collection1.value.equals(collection3.value)).toBe(false);
      }
    });

    it('should compare collections by size and content', () => {
      const small = BasicCollectionVO.create(['a']);
      const large = BasicCollectionVO.create(['a', 'b', 'c']);

      if (isOk(small) && isOk(large)) {
        expect(small.value.compare(large.value)).toBe(-1);
        expect(large.value.compare(small.value)).toBe(1);
        expect(small.value.compare(small.value)).toBe(0);
      }
    });
  });

  describe('Serialization', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should convert to string correctly', () => {
      const result = BasicCollectionVO.create(['item1', 'item2']);

      if (isOk(result)) {
        const str = result.value.toString();
        expect(str).toContain('BasicCollection');
        expect(str).toContain('item1');
        expect(str).toContain('item2');
      }
    });

    it('should convert to JSON correctly', () => {
      const result = BasicCollectionVO.create(['item1', 'item2']);

      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json).toEqual({
          items: ['item1', 'item2'],
          type: 'BasicCollection',
        });
      }
    });

    it('should convert to array correctly', () => {
      const result = BasicCollectionVO.create(['item1', 'item2']);

      if (isOk(result)) {
        expect(result.value.toArray()).toEqual(['item1', 'item2']);
      }
    });
  });

  describe('Business Methods', () => {
    const BusinessCollectionVO = createCollectionVO({
      name: 'BusinessCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      businessMethods: [
        {
          name: 'countStartingWith',
          implementation: (items: MockStringItem[]) =>
            items.filter((item) => item.value.startsWith('test')).length,
        },
        {
          name: 'hasDuplicates',
          implementation: (items: MockStringItem[]) => {
            const values = items.map((item) => item.value);
            return new Set(values).size !== values.length;
          },
        },
      ],
      errors: mockErrors,
    });

    it('should support custom business methods', () => {
      const result = BusinessCollectionVO.create(['test1', 'test2', 'other']);

      if (isOk(result)) {
        const collection = result.value as any;
        expect(collection.countStartingWith()).toBe(2);
        expect(collection.hasDuplicates()).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should handle large collections', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `item${i}`);
      const result = BasicCollectionVO.create(largeArray);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(100);
      }
    });

    it('should handle empty operations gracefully', () => {
      const emptyResult = BasicCollectionVO.create([]);
      if (isOk(emptyResult)) {
        const emptyCollection = emptyResult.value;

        const nonExistentItem = new MockStringItem('missing');
        const removeResult = emptyCollection.remove(nonExistentItem);

        expect(isErr(removeResult)).toBe(true);
      }
    });

    it('should maintain immutability', () => {
      const original = BasicCollectionVO.create(['a', 'b']);
      if (isOk(original)) {
        const newItem = new MockStringItem('c');
        const modified = original.value.add(newItem);

        if (isOk(modified)) {
          expect(original.value.size).toBe(2);
          expect(modified.value.size).toBe(3);
          expect(original.value.contains(newItem)).toBe(false);
          expect(modified.value.contains(newItem)).toBe(true);
        }
      }
    });
  });

  describe('Error Handling', () => {
    const BasicCollectionVO = createCollectionVO({
      name: 'BasicCollection',
      itemName: 'Item',
      itemFactory: mockStringItemFactory,
      allowEmpty: true,
      allowDuplicates: true,
      errors: mockErrors,
    });

    it('should provide descriptive error messages', () => {
      const SizedCollectionVO = createCollectionVO({
        name: 'SizedCollection',
        itemName: 'Item',
        itemFactory: mockStringItemFactory,
        maxCount: 2,
        allowEmpty: true,
        allowDuplicates: true,
        errors: mockErrors,
      });

      const oversized = SizedCollectionVO.create(['a', 'b', 'c']);

      expect(isErr(oversized)).toBe(true);
      if (isErr(oversized)) {
        expect(oversized.error.detail).toContain('cannot exceed 2 items');
        expect(oversized.error.context).toHaveProperty('count', 3);
        expect(oversized.error.context).toHaveProperty('maxAllowed', 2);
      }
    });

    it('should handle invalid item creation', () => {
      const result = BasicCollectionVO.create([123 as any]);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('must be a string');
      }
    });
  });
});
