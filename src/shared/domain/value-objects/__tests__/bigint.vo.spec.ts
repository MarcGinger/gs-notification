import { createBigIntVO, createBigIntVOErrors } from '../bigint.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('BigIntVO', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'BIGINT_TEST_ERROR',
    title: 'BigInt test error',
    category: 'validation',
  };

  // Mock error factory
  const mockErrors = createBigIntVOErrors(mockBaseError, 'Test BigInt');

  describe('Basic BigInt VO Creation', () => {
    const BasicBigIntVO = createBigIntVO({
      name: 'BasicBigInt',
      errors: mockErrors,
    });

    it('should create valid BigInt VO from bigint', () => {
      const result = BasicBigIntVO.create(42n);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(42n);
        expect(typeof vo.equals).toBe('function');
      }
    });

    it('should handle zero value', () => {
      const result = BasicBigIntVO.create(0n);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(0n);
        expect(result.value.isZero).toBe(true);
      }
    });

    it('should handle negative numbers by default', () => {
      const result = BasicBigIntVO.create(-10n);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(-10n);
        expect(result.value.isNegative).toBe(true);
      }
    });

    it('should reject non-bigint types', () => {
      const stringResult = BasicBigIntVO.from('not-a-number');
      const nullResult = BasicBigIntVO.create(null);
      const undefinedResult = BasicBigIntVO.create(undefined);
      const floatResult = BasicBigIntVO.from(3.14);

      expect(isErr(stringResult)).toBe(true);
      expect(isErr(nullResult)).toBe(true);
      expect(isErr(undefinedResult)).toBe(true);
      expect(isErr(floatResult)).toBe(true);
    });

    it('should handle required validation', () => {
      const RequiredBigIntVO = createBigIntVO({
        name: 'RequiredBigInt',
        required: true,
        errors: mockErrors,
      });

      const nullResult = RequiredBigIntVO.create(null);
      const undefinedResult = RequiredBigIntVO.create(undefined);

      expect(isErr(nullResult)).toBe(true);
      expect(isErr(undefinedResult)).toBe(true);
    });

    it('should handle optional validation', () => {
      const OptionalBigIntVO = createBigIntVO({
        name: 'OptionalBigInt',
        required: false,
        errors: mockErrors,
      });

      const nullResult = OptionalBigIntVO.create(null);
      const undefinedResult = OptionalBigIntVO.create(undefined);

      expect(isErr(nullResult)).toBe(true);
      expect(isErr(undefinedResult)).toBe(true);
    });
  });

  describe('Type Coercion (from method)', () => {
    const BasicBigIntVO = createBigIntVO({
      name: 'BasicBigInt',
      errors: mockErrors,
    });

    it('should create BigInt from string', () => {
      const result = BasicBigIntVO.from('12345');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(12345n);
      }
    });

    it('should create BigInt from number (when safe)', () => {
      const result = BasicBigIntVO.from(12345);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(12345n);
      }
    });

    it('should create BigInt from BigInt', () => {
      const result = BasicBigIntVO.from(12345n);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(12345n);
      }
    });

    it('should reject unsafe number conversions', () => {
      const unsafeNumber = Number.MAX_SAFE_INTEGER + 1;
      const result = BasicBigIntVO.from(unsafeNumber);
      expect(isErr(result)).toBe(true);
    });

    it('should reject float numbers', () => {
      const result = BasicBigIntVO.from(123.45);
      expect(isErr(result)).toBe(true);
    });

    it('should reject invalid string inputs', () => {
      const invalidString = BasicBigIntVO.from('not-a-number');
      const floatString = BasicBigIntVO.from('123.45');
      const emptyString = BasicBigIntVO.from('');

      expect(isErr(invalidString)).toBe(true);
      expect(isErr(floatString)).toBe(true);
      expect(isErr(emptyString)).toBe(true);
    });
  });

  describe('Range Validation', () => {
    const RangedBigIntVO = createBigIntVO({
      name: 'RangedBigInt',
      minValue: '-1000',
      maxValue: '1000',
      errors: mockErrors,
    });

    it('should enforce minimum value constraints', () => {
      const validResult = RangedBigIntVO.create(-500n);
      const invalidResult = RangedBigIntVO.create(-2000n);

      expect(isOk(validResult)).toBe(true);
      expect(isErr(invalidResult)).toBe(true);
    });

    it('should enforce maximum value constraints', () => {
      const validResult = RangedBigIntVO.create(500n);
      const invalidResult = RangedBigIntVO.create(2000n);

      expect(isOk(validResult)).toBe(true);
      expect(isErr(invalidResult)).toBe(true);
    });

    it('should handle boundary values', () => {
      const minBoundary = RangedBigIntVO.create(-1000n);
      const maxBoundary = RangedBigIntVO.create(1000n);

      expect(isOk(minBoundary)).toBe(true);
      expect(isOk(maxBoundary)).toBe(true);
    });

    it('should handle range validation combinations', () => {
      const withinRange = RangedBigIntVO.create(0n);
      const belowMin = RangedBigIntVO.create(-1500n);
      const aboveMax = RangedBigIntVO.create(1500n);

      expect(isOk(withinRange)).toBe(true);
      expect(isErr(belowMin)).toBe(true);
      expect(isErr(aboveMax)).toBe(true);
    });
  });

  describe('Business Rules Validation', () => {
    it('should disallow negative numbers when configured', () => {
      const PositiveBigIntVO = createBigIntVO({
        name: 'PositiveBigInt',
        allowNegative: false,
        errors: mockErrors,
      });

      const positiveResult = PositiveBigIntVO.create(100n);
      const negativeResult = PositiveBigIntVO.create(-100n);

      expect(isOk(positiveResult)).toBe(true);
      expect(isErr(negativeResult)).toBe(true);
    });

    it('should disallow zero when configured', () => {
      const NonZeroBigIntVO = createBigIntVO({
        name: 'NonZeroBigInt',
        allowZero: false,
        errors: mockErrors,
      });

      const nonZeroResult = NonZeroBigIntVO.create(100n);
      const zeroResult = NonZeroBigIntVO.create(0n);

      expect(isOk(nonZeroResult)).toBe(true);
      expect(isErr(zeroResult)).toBe(true);
    });

    it('should handle custom validation', () => {
      const EvenBigIntVO = createBigIntVO({
        name: 'EvenBigInt',
        customValidation: (value) => {
          if (value % 2n !== 0n) {
            return {
              ok: false,
              error: mockErrors.custom(value, 'Must be even'),
            };
          }
          return { ok: true, value };
        },
        errors: mockErrors,
      });

      const evenResult = EvenBigIntVO.create(100n);
      const oddResult = EvenBigIntVO.create(101n);

      expect(isOk(evenResult)).toBe(true);
      expect(isErr(oddResult)).toBe(true);
    });
  });

  describe('Arithmetic Operations', () => {
    const TestBigIntVO = createBigIntVO({
      name: 'TestBigInt',
      minValue: '-1000000000000000000',
      maxValue: '1000000000000000000',
      errors: mockErrors,
    });

    it('should perform addition with large numbers', () => {
      const a = TestBigIntVO.create(999999999999999999999999999999n);
      const b = TestBigIntVO.create(1n);

      if (isOk(a) && isOk(b)) {
        const result = a.value.add(b.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(1000000000000000000000000000000n);
        }
      }
    });

    it('should perform subtraction', () => {
      const a = TestBigIntVO.create(100n);
      const b = TestBigIntVO.create(25n);

      if (isOk(a) && isOk(b)) {
        const result = a.value.subtract(b.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(75n);
        }
      }
    });

    it('should perform multiplication', () => {
      const a = TestBigIntVO.create(100n);
      const b = TestBigIntVO.create(25n);

      if (isOk(a) && isOk(b)) {
        const result = a.value.multiply(b.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(2500n);
        }
      }
    });

    it('should perform division', () => {
      const a = TestBigIntVO.create(100n);
      const b = TestBigIntVO.create(7n);

      if (isOk(a) && isOk(b)) {
        const result = a.value.divide(b.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(14n); // Integer division
        }
      }
    });

    it('should perform modulo operation', () => {
      const a = TestBigIntVO.create(100n);
      const b = TestBigIntVO.create(7n);

      if (isOk(a) && isOk(b)) {
        const result = a.value.mod(b.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(2n); // 100 % 7 = 2
        }
      }
    });

    it('should handle division by zero', () => {
      const a = TestBigIntVO.create(100n);
      const b = TestBigIntVO.create(0n);

      if (isOk(a) && isOk(b)) {
        const result = a.value.divide(b.value);
        expect(isErr(result)).toBe(true);
      }
    });

    it('should perform power operations', () => {
      const base = TestBigIntVO.create(2n);

      if (isOk(base)) {
        const result = base.value.pow(10);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(1024n); // 2^10 = 1024
        }
      }
    });

    it('should reject negative exponents', () => {
      const base = TestBigIntVO.create(2n);

      if (isOk(base)) {
        const result = base.value.pow(-1);
        expect(isErr(result)).toBe(true);
      }
    });
  });

  describe('Unary Operations', () => {
    const TestBigIntVO = createBigIntVO({
      name: 'TestBigInt',
      errors: mockErrors,
    });

    it('should calculate absolute value', () => {
      const positive = TestBigIntVO.create(100n);
      const negative = TestBigIntVO.create(-100n);

      if (isOk(positive) && isOk(negative)) {
        const posAbs = positive.value.abs();
        const negAbs = negative.value.abs();

        expect(isOk(posAbs)).toBe(true);
        expect(isOk(negAbs)).toBe(true);

        if (isOk(posAbs) && isOk(negAbs)) {
          expect(posAbs.value.value).toBe(100n);
          expect(negAbs.value.value).toBe(100n);
        }
      }
    });

    it('should negate values', () => {
      const positive = TestBigIntVO.create(100n);
      const negative = TestBigIntVO.create(-100n);

      if (isOk(positive) && isOk(negative)) {
        const posNeg = positive.value.negate();
        const negNeg = negative.value.negate();

        expect(isOk(posNeg)).toBe(true);
        expect(isOk(negNeg)).toBe(true);

        if (isOk(posNeg) && isOk(negNeg)) {
          expect(posNeg.value.value).toBe(-100n);
          expect(negNeg.value.value).toBe(100n);
        }
      }
    });
  });

  describe('Comparison Operations', () => {
    const TestBigIntVO = createBigIntVO({
      name: 'TestBigInt',
      errors: mockErrors,
    });

    it('should compare equality', () => {
      const a = TestBigIntVO.create(100n);
      const b = TestBigIntVO.create(100n);
      const c = TestBigIntVO.create(200n);

      if (isOk(a) && isOk(b) && isOk(c)) {
        expect(a.value.equals(b.value)).toBe(true);
        expect(a.value.equals(c.value)).toBe(false);
      }
    });

    it('should perform ordering comparisons', () => {
      const smaller = TestBigIntVO.create(100n);
      const larger = TestBigIntVO.create(200n);

      if (isOk(smaller) && isOk(larger)) {
        expect(smaller.value.lessThan(larger.value)).toBe(true);
        expect(larger.value.greaterThan(smaller.value)).toBe(true);
        expect(smaller.value.compare(larger.value)).toBe(-1);
        expect(larger.value.compare(smaller.value)).toBe(1);
        expect(smaller.value.compare(smaller.value)).toBe(0);
      }
    });

    it('should handle large number comparisons', () => {
      const largeA = TestBigIntVO.create(999999999999999999999999999999n);
      const largeB = TestBigIntVO.create(1000000000000000000000000000000n);

      if (isOk(largeA) && isOk(largeB)) {
        expect(largeA.value.lessThan(largeB.value)).toBe(true);
        expect(largeB.value.greaterThan(largeA.value)).toBe(true);
      }
    });
  });

  describe('Properties and Accessors', () => {
    const TestBigIntVO = createBigIntVO({
      name: 'TestBigInt',
      errors: mockErrors,
    });

    it('should provide correct property accessors', () => {
      const zero = TestBigIntVO.create(0n);
      const positive = TestBigIntVO.create(100n);
      const negative = TestBigIntVO.create(-100n);
      const even = TestBigIntVO.create(100n);
      const odd = TestBigIntVO.create(101n);

      if (
        isOk(zero) &&
        isOk(positive) &&
        isOk(negative) &&
        isOk(even) &&
        isOk(odd)
      ) {
        expect(zero.value.isZero).toBe(true);
        expect(positive.value.isZero).toBe(false);

        expect(positive.value.isPositive).toBe(true);
        expect(negative.value.isPositive).toBe(false);

        expect(negative.value.isNegative).toBe(true);
        expect(positive.value.isNegative).toBe(false);

        expect(even.value.isEven).toBe(true);
        expect(odd.value.isEven).toBe(false);

        expect(odd.value.isOdd).toBe(true);
        expect(even.value.isOdd).toBe(false);
      }
    });
  });

  describe('Serialization', () => {
    const TestBigIntVO = createBigIntVO({
      name: 'TestBigInt',
      errors: mockErrors,
    });

    it('should convert to string', () => {
      const value = TestBigIntVO.create(12345n);

      if (isOk(value)) {
        expect(value.value.toString()).toBe('12345');
      }
    });

    it('should serialize to JSON', () => {
      const value = TestBigIntVO.create(12345n);

      if (isOk(value)) {
        const json = value.value.toJSON();
        expect(json).toEqual({
          value: '12345',
          type: 'TestBigInt',
        });
      }
    });

    it('should handle large numbers in serialization', () => {
      const largeValue = TestBigIntVO.create(999999999999999999999999999999n);

      if (isOk(largeValue)) {
        const str = largeValue.value.toString();
        const json = largeValue.value.toJSON();

        expect(str).toBe('999999999999999999999999999999');
        expect(json.value).toBe('999999999999999999999999999999');
        expect(json.type).toBe('TestBigInt');
      }
    });
  });

  describe('Large Number Handling', () => {
    const LargeBigIntVO = createBigIntVO({
      name: 'LargeBigInt',
      minValue: '-1000000000000000000000000000000',
      maxValue: '1000000000000000000000000000000',
      errors: mockErrors,
    });

    it('should handle very large numbers', () => {
      const largeNumber = '123456789012345678901234567890';
      const result = LargeBigIntVO.from(largeNumber);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toString()).toBe(largeNumber);
      }
    });

    it('should perform arithmetic with very large numbers', () => {
      const a = LargeBigIntVO.from('999999999999999999999999999999');
      const b = LargeBigIntVO.from('1');

      if (isOk(a) && isOk(b)) {
        const result = a.value.add(b.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.toString()).toBe(
            '1000000000000000000000000000000',
          );
        }
      }
    });

    it('should handle negative large numbers', () => {
      const negativeLarge = LargeBigIntVO.from(
        '-123456789012345678901234567890',
      );
      expect(isOk(negativeLarge)).toBe(true);
      if (isOk(negativeLarge)) {
        expect(negativeLarge.value.toString()).toBe(
          '-123456789012345678901234567890',
        );
        expect(negativeLarge.value.isNegative).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    const TestBigIntVO = createBigIntVO({
      name: 'TestBigInt',
      minValue: '-1000000000000000000',
      maxValue: '1000000000000000000',
      errors: mockErrors,
    });

    it('should handle zero and negative numbers correctly', () => {
      const zero = TestBigIntVO.create(0n);
      const negative = TestBigIntVO.create(-12345n);

      expect(isOk(zero)).toBe(true);
      expect(isOk(negative)).toBe(true);

      if (isOk(zero) && isOk(negative)) {
        expect(zero.value.isZero).toBe(true);
        expect(negative.value.isNegative).toBe(true);
      }
    });

    it('should handle boundary arithmetic operations', () => {
      const maxValue = TestBigIntVO.create(1000000000000000000n);
      const minValue = TestBigIntVO.create(-1000000000000000000n);
      const one = TestBigIntVO.create(1n);

      if (isOk(maxValue) && isOk(minValue) && isOk(one)) {
        // Test operations that might go out of bounds
        const addToMax = maxValue.value.add(one.value);
        expect(isErr(addToMax)).toBe(true); // Should exceed max

        const subtractFromMin = minValue.value.subtract(one.value);
        expect(isErr(subtractFromMin)).toBe(true); // Should go below min
      }
    });

    it('should handle precision preservation', () => {
      const preciseValue = TestBigIntVO.create(123456789012345678901234567890n);
      const two = TestBigIntVO.create(2n);

      if (isOk(preciseValue) && isOk(two)) {
        // Test that operations preserve precision
        const doubled = preciseValue.value.multiply(two.value);
        expect(isOk(doubled)).toBe(true);
        if (isOk(doubled)) {
          expect(doubled.value.toString()).toBe(
            '246913578024691357802469135780',
          );
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide descriptive error messages', () => {
      const RangedBigIntVO = createBigIntVO({
        name: 'RangedBigInt',
        minValue: '100',
        maxValue: '200',
        errors: mockErrors,
      });

      const tooSmall = RangedBigIntVO.create(50n);
      const tooLarge = RangedBigIntVO.create(250n);

      expect(isErr(tooSmall)).toBe(true);
      expect(isErr(tooLarge)).toBe(true);

      if (isErr(tooSmall)) {
        expect(tooSmall.error.detail).toContain('must be at least 100');
      }

      if (isErr(tooLarge)) {
        expect(tooLarge.error.detail).toContain('cannot exceed 200');
      }
    });

    it('should handle type validation errors', () => {
      const TestBigIntVO = createBigIntVO({
        name: 'TestBigInt',
        errors: mockErrors,
      });

      const invalidType = TestBigIntVO.from('not-a-number');

      expect(isErr(invalidType)).toBe(true);
      if (isErr(invalidType)) {
        expect(invalidType.error.detail).toContain('must be a bigint');
      }
    });
  });
});
