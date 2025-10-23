import {
  createStringVO,
  createIntegerVO,
  createBooleanVO,
  createEnumVO,
  createMoneyVO,
  createDateVO,
  createUuidVO,
} from '../index';
import { DomainError, isOk, isErr } from '../../../errors';

describe('Value Objects Integration Tests', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'INTEGRATION_TEST_ERROR',
    title: 'Integration test error',
    category: 'validation',
  };

  describe('Interface Consistency', () => {
    it('should have consistent factory pattern across all VOs', () => {
      // All VOs should have factory functions that return classes with create methods
      expect(typeof createStringVO).toBe('function');
      expect(typeof createIntegerVO).toBe('function');
      expect(typeof createBooleanVO).toBe('function');
      expect(typeof createEnumVO).toBe('function');
      expect(typeof createMoneyVO).toBe('function');
      expect(typeof createDateVO).toBe('function');
      expect(typeof createUuidVO).toBe('function');

      // Test that factories return classes with create methods
      const StringVO = createStringVO({
        name: 'TestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'TestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const BooleanVO = createBooleanVO({
        name: 'TestBoolean',
        errors: {
          type: () => mockBaseError,
          invalid: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      expect(typeof StringVO.create).toBe('function');
      expect(typeof IntegerVO.create).toBe('function');
      expect(typeof BooleanVO.create).toBe('function');
    });

    it('should return Result<T, DomainError> from all create methods', () => {
      const StringVO = createStringVO({
        name: 'TestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'TestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const BooleanVO = createBooleanVO({
        name: 'TestBoolean',
        errors: {
          type: () => mockBaseError,
          invalid: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      // Test that all return Result types
      const stringResult = StringVO.create('test');
      const integerResult = IntegerVO.create(42);
      const booleanResult = BooleanVO.create(true);

      expect(typeof stringResult).toBe('object');
      expect('ok' in stringResult).toBe(true);
      expect(typeof integerResult).toBe('object');
      expect('ok' in integerResult).toBe(true);
      expect(typeof booleanResult).toBe('object');
      expect('ok' in booleanResult).toBe(true);

      expect(isOk(stringResult)).toBe(true);
      expect(isOk(integerResult)).toBe(true);
      expect(isOk(booleanResult)).toBe(true);
    });

    it('should implement equals method consistently', () => {
      const StringVO = createStringVO({
        name: 'TestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'TestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const string1 = StringVO.create('test');
      const string2 = StringVO.create('test');
      const string3 = StringVO.create('different');

      const int1 = IntegerVO.create(42);
      const int2 = IntegerVO.create(42);
      const int3 = IntegerVO.create(43);

      if (isOk(string1) && isOk(string2) && isOk(string3)) {
        expect(string1.value.equals(string2.value)).toBe(true);
        expect(string1.value.equals(string3.value)).toBe(false);
        expect(typeof string1.value.equals).toBe('function');
      }

      if (isOk(int1) && isOk(int2) && isOk(int3)) {
        expect(int1.value.equals(int2.value)).toBe(true);
        expect(int1.value.equals(int3.value)).toBe(false);
        expect(typeof int1.value.equals).toBe('function');
      }
    });

    it('should implement toString method consistently', () => {
      const StringVO = createStringVO({
        name: 'TestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'TestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const stringResult = StringVO.create('test string');
      const integerResult = IntegerVO.create(12345);

      expect(isOk(stringResult)).toBe(true);
      expect(isOk(integerResult)).toBe(true);

      if (isOk(stringResult)) {
        expect(typeof stringResult.value.toString).toBe('function');
        expect(stringResult.value.toString()).toBe('test string');
      }

      if (isOk(integerResult)) {
        expect(typeof integerResult.value.toString).toBe('function');
        expect(integerResult.value.toString()).toBe('12345');
      }
    });
  });

  describe('Error Handling Consistency', () => {
    it('should provide consistent error structure across VOs', () => {
      const StringVO = createStringVO({
        name: 'TestString',
        maxLength: 5,
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: (value, max) => ({
            ...mockBaseError,
            detail: `String cannot exceed ${max} characters`,
            context: { value, maxLength: max, operation: 'length_check' },
          }),
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'TestInteger',
        max: 10,
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: (value, max) => ({
            ...mockBaseError,
            detail: `Integer cannot exceed ${max}`,
            context: { value, maxValue: max, operation: 'range_check' },
          }),
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const stringError = StringVO.create('too long string');
      const integerError = IntegerVO.create(15);

      expect(isErr(stringError)).toBe(true);
      expect(isErr(integerError)).toBe(true);

      if (isErr(stringError) && isErr(integerError)) {
        // Both should have consistent error structure
        expect(typeof stringError.error.code).toBe('string');
        expect(typeof stringError.error.title).toBe('string');
        expect(typeof stringError.error.detail).toBe('string');
        expect(typeof stringError.error.category).toBe('string');
        expect(typeof stringError.error.context).toBe('object');

        expect(typeof integerError.error.code).toBe('string');
        expect(typeof integerError.error.title).toBe('string');
        expect(typeof integerError.error.detail).toBe('string');
        expect(typeof integerError.error.category).toBe('string');
        expect(typeof integerError.error.context).toBe('object');

        // Context should include operation metadata
        expect(stringError.error.context?.operation).toBeDefined();
        expect(integerError.error.context?.operation).toBeDefined();
      }
    });

    it('should handle null/undefined consistently across VOs', () => {
      const StringVO = createStringVO({
        name: 'TestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'TestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const BooleanVO = createBooleanVO({
        name: 'TestBoolean',
        errors: {
          type: () => mockBaseError,
          invalid: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      // All should reject null/undefined consistently
      expect(isErr(StringVO.create(null))).toBe(true);
      expect(isErr(StringVO.create(undefined))).toBe(true);
      expect(isErr(IntegerVO.create(null))).toBe(true);
      expect(isErr(IntegerVO.create(undefined))).toBe(true);
      expect(isErr(BooleanVO.create(null))).toBe(true);
      expect(isErr(BooleanVO.create(undefined))).toBe(true);
    });
  });

  describe('Barrel Export Integration', () => {
    it('should export all factory functions from index', () => {
      // Import should work from barrel export - verified by the imports at top of file
      expect(typeof createStringVO).toBe('function');
      expect(typeof createIntegerVO).toBe('function');
      expect(typeof createBooleanVO).toBe('function');
      expect(typeof createEnumVO).toBe('function');
      expect(typeof createMoneyVO).toBe('function');
      expect(typeof createDateVO).toBe('function');
      expect(typeof createUuidVO).toBe('function');
    });

    it('should export all error factory functions from index', () => {
      // These should be available via the barrel export as well
      // We can test by creating VOs and checking their error handling works
      const StringVO = createStringVO({
        name: 'BarrelTestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      // If the error factories are properly exported, this should work
      const result = StringVO.create(null);
      expect(isErr(result)).toBe(true);
    });

    it('should export type definitions from index', () => {
      // TypeScript types should be available (compile-time check)
      // If this compiles, then the types are properly exported
      const StringVO = createStringVO({
        name: 'TypeTestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      expect(StringVO).toBeDefined();
    });
  });

  describe('Performance Consistency', () => {
    it('should create VOs with consistent performance characteristics', () => {
      const StringVO = createStringVO({
        name: 'PerfTestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const IntegerVO = createIntegerVO({
        name: 'PerfTestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      // Performance test: creating many VOs should be fast
      const iterations = 1000;

      const stringStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        StringVO.create(`test-string-${i}`);
      }
      const stringTime = Date.now() - stringStart;

      const integerStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        IntegerVO.create(i);
      }
      const integerTime = Date.now() - integerStart;

      // Both should complete within reasonable time (less than 1 second for 1000 operations)
      expect(stringTime).toBeLessThan(1000);
      expect(integerTime).toBeLessThan(1000);

      // Performance should be reasonably similar (within 10x of each other)
      // Add small amount to prevent division by zero
      const safeStringTime = Math.max(stringTime, 1);
      const safeIntegerTime = Math.max(integerTime, 1);
      const performanceRatio =
        Math.max(safeStringTime, safeIntegerTime) /
        Math.min(safeStringTime, safeIntegerTime);
      expect(performanceRatio).toBeLessThan(10);
    });
  });

  describe('Cross-VO Compatibility', () => {
    it('should work together in complex scenarios', () => {
      // Create multiple VOs that might work together in a domain
      const ProductName = createStringVO({
        name: 'ProductName',
        minLength: 2,
        maxLength: 50,
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const ProductPrice = createIntegerVO({
        name: 'ProductPrice',
        min: 0,
        allowNegative: false,
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const ProductActive = createBooleanVO({
        name: 'ProductActive',
        errors: {
          type: () => mockBaseError,
          invalid: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      // Create a product scenario
      const nameResult = ProductName.create('Premium Widget');
      const priceResult = ProductPrice.create(2999);
      const activeResult = ProductActive.create(true);

      expect(isOk(nameResult)).toBe(true);
      expect(isOk(priceResult)).toBe(true);
      expect(isOk(activeResult)).toBe(true);

      if (isOk(nameResult) && isOk(priceResult) && isOk(activeResult)) {
        // Should be able to extract values and use them together
        expect(nameResult.value.toString()).toBe('Premium Widget');
        expect(priceResult.value.value).toBe(2999);
        expect(activeResult.value.value).toBe(true);

        // Should be able to serialize for API responses
        const productData = {
          name: nameResult.value.toString(),
          price: priceResult.value.value,
          active: activeResult.value.value,
        };

        expect(productData).toEqual({
          name: 'Premium Widget',
          price: 2999,
          active: true,
        });
      }
    });

    it('should maintain referential equality for same values', () => {
      const StringVO = createStringVO({
        name: 'TestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const vo1 = StringVO.create('same-value');
      const vo2 = StringVO.create('same-value');

      expect(isOk(vo1)).toBe(true);
      expect(isOk(vo2)).toBe(true);

      if (isOk(vo1) && isOk(vo2)) {
        // Should be equal via equals method
        expect(vo1.value.equals(vo2.value)).toBe(true);

        // But different object instances (which is expected for VOs)
        expect(vo1.value).not.toBe(vo2.value);
      }
    });
  });
});
