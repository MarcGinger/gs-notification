import { createIntegerVO, createIntegerVOErrors } from '../integer.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('IntegerVO', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'TEST_ERROR',
    title: 'Test error',
    category: 'validation',
  };

  // Mock error factory
  const mockErrors = createIntegerVOErrors(mockBaseError, 'TestEntity');

  describe('Basic Integer VO Creation', () => {
    const BasicIntegerVO = createIntegerVO({
      name: 'BasicInteger',
      errors: mockErrors,
    });

    it('should create valid integer VO with basic input', () => {
      const result = BasicIntegerVO.create(42);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(42);
        expect(typeof vo.equals).toBe('function');
      }
    });

    it('should handle zero value', () => {
      const result = BasicIntegerVO.create(0);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(0);
      }
    });

    it('should handle negative numbers by default', () => {
      const result = BasicIntegerVO.create(-10);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(-10);
      }
    });

    it('should reject non-numeric types', () => {
      const nonNumberResult = BasicIntegerVO.create('not-a-number');
      const nullResult = BasicIntegerVO.create(null);
      const undefinedResult = BasicIntegerVO.create(undefined);

      expect(isErr(nonNumberResult)).toBe(true);
      expect(isErr(nullResult)).toBe(true);
      expect(isErr(undefinedResult)).toBe(true);
    });
  });

  describe('Range Validation', () => {
    const RangeConstrainedVO = createIntegerVO({
      name: 'RangeConstrained',
      min: 1,
      max: 100,
      errors: mockErrors,
    });

    it('should accept values within range', () => {
      const validResults = [
        RangeConstrainedVO.create(1), // min value
        RangeConstrainedVO.create(50), // middle value
        RangeConstrainedVO.create(100), // max value
      ];

      validResults.forEach((result) => {
        expect(isOk(result)).toBe(true);
      });
    });

    it('should reject values below minimum', () => {
      const result = RangeConstrainedVO.create(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('at least');
      }
    });

    it('should reject values above maximum', () => {
      const result = RangeConstrainedVO.create(101);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot exceed');
      }
    });
  });

  describe('Allow Negative Configuration', () => {
    const NoNegativeVO = createIntegerVO({
      name: 'NoNegative',
      allowNegative: false,
      errors: mockErrors,
    });

    it('should accept positive values', () => {
      const result = NoNegativeVO.create(42);
      expect(isOk(result)).toBe(true);
    });

    it('should reject negative values', () => {
      const result = NoNegativeVO.create(-1);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('negative');
      }
    });

    it('should handle zero based on allowZero configuration', () => {
      const result = NoNegativeVO.create(0);
      expect(isOk(result)).toBe(true); // Zero allowed by default
    });
  });

  describe('Allow Zero Configuration', () => {
    const NoZeroVO = createIntegerVO({
      name: 'NoZero',
      allowZero: false,
      errors: mockErrors,
    });

    it('should reject zero when not allowed', () => {
      const result = NoZeroVO.create(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('zero');
      }
    });

    it('should accept non-zero values', () => {
      const positiveResult = NoZeroVO.create(1);
      const negativeResult = NoZeroVO.create(-1);

      expect(isOk(positiveResult)).toBe(true);
      expect(isOk(negativeResult)).toBe(true);
    });
  });

  describe('Decimal Configuration', () => {
    const DecimalVO = createIntegerVO({
      name: 'DecimalNumber',
      allowDecimals: true,
      decimalPlaces: 2,
      errors: mockErrors,
    });

    it('should accept decimals when allowed', () => {
      const result = DecimalVO.create(42.25);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(42.25);
      }
    });

    it('should reject too many decimal places', () => {
      const result = DecimalVO.create(42.123);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('decimal');
      }
    });
  });

  describe('Complex Configuration', () => {
    const ComplexIntegerVO = createIntegerVO({
      name: 'ComplexInteger',
      min: 10,
      max: 1000,
      allowNegative: false,
      allowZero: false,
      errors: mockErrors,
    });

    it('should apply all constraints together', () => {
      const validResult = ComplexIntegerVO.create(100);
      expect(isOk(validResult)).toBe(true);

      const tooSmall = ComplexIntegerVO.create(5);
      const tooLarge = ComplexIntegerVO.create(1001);
      const negative = ComplexIntegerVO.create(-10);
      const zero = ComplexIntegerVO.create(0);

      expect(isErr(tooSmall)).toBe(true);
      expect(isErr(tooLarge)).toBe(true);
      expect(isErr(negative)).toBe(true);
      expect(isErr(zero)).toBe(true);
    });
  });

  describe('Value Object Behavior', () => {
    const TestIntegerVO = createIntegerVO({
      name: 'TestInteger',
      errors: mockErrors,
    });

    it('should implement equals method correctly', () => {
      const result1 = TestIntegerVO.create(42);
      const result2 = TestIntegerVO.create(42);
      const result3 = TestIntegerVO.create(43);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isOk(result3)).toBe(true);

      if (isOk(result1) && isOk(result2) && isOk(result3)) {
        expect(result1.value.equals(result2.value)).toBe(true);
        expect(result1.value.equals(result3.value)).toBe(false);
      }
    });

    it('should provide arithmetic operations', () => {
      const vo1 = TestIntegerVO.create(10);
      const vo2 = TestIntegerVO.create(5);

      expect(isOk(vo1)).toBe(true);
      expect(isOk(vo2)).toBe(true);

      if (isOk(vo1) && isOk(vo2)) {
        // Test addition
        const addResult = vo1.value.add(vo2.value);
        expect(isOk(addResult)).toBe(true);
        if (isOk(addResult)) {
          expect(addResult.value.value).toBe(15);
        }

        // Test subtraction
        const subResult = vo1.value.subtract(vo2.value);
        expect(isOk(subResult)).toBe(true);
        if (isOk(subResult)) {
          expect(subResult.value.value).toBe(5);
        }
      }
    });

    it('should provide comparison operations', () => {
      const vo1 = TestIntegerVO.create(10);
      const vo2 = TestIntegerVO.create(20);

      expect(isOk(vo1)).toBe(true);
      expect(isOk(vo2)).toBe(true);

      if (isOk(vo1) && isOk(vo2)) {
        expect(vo1.value.compare(vo2.value)).toBe(-1);
        expect(vo2.value.compare(vo1.value)).toBe(1);
        expect(vo1.value.compare(vo1.value)).toBe(0);
      }
    });

    it('should provide boolean property access', () => {
      const positiveResult = TestIntegerVO.create(10);
      const negativeResult = TestIntegerVO.create(-5);
      const zeroResult = TestIntegerVO.create(0);

      if (isOk(positiveResult)) {
        expect(positiveResult.value.isPositive).toBe(true);
        expect(positiveResult.value.isNegative).toBe(false);
        expect(positiveResult.value.isZero).toBe(false);
      }

      if (isOk(negativeResult)) {
        expect(negativeResult.value.isPositive).toBe(false);
        expect(negativeResult.value.isNegative).toBe(true);
        expect(negativeResult.value.isZero).toBe(false);
      }

      if (isOk(zeroResult)) {
        expect(zeroResult.value.isPositive).toBe(false);
        expect(zeroResult.value.isNegative).toBe(false);
        expect(zeroResult.value.isZero).toBe(true);
      }
    });

    it('should provide toString behavior', () => {
      const result = TestIntegerVO.create(123);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toString()).toBe('123');
      }
    });
  });

  describe('Error Handling', () => {
    const TestIntegerVO = createIntegerVO({
      name: 'TestInteger',
      min: 1,
      max: 10,
      allowDecimals: false,
      errors: mockErrors,
    });

    it('should provide detailed error messages for different violations', () => {
      const tooSmall = TestIntegerVO.create(0);
      const tooLarge = TestIntegerVO.create(11);
      const decimal = TestIntegerVO.create(5.5);
      const nonNumber = TestIntegerVO.create('not a number');

      expect(isErr(tooSmall)).toBe(true);
      if (isErr(tooSmall)) {
        expect(tooSmall.error.detail).toContain('at least');
      }

      expect(isErr(tooLarge)).toBe(true);
      if (isErr(tooLarge)) {
        expect(tooLarge.error.detail).toContain('cannot exceed');
      }

      expect(isErr(decimal)).toBe(true);
      if (isErr(decimal)) {
        expect(decimal.error.detail).toContain('whole number');
      }

      expect(isErr(nonNumber)).toBe(true);
      if (isErr(nonNumber)) {
        expect(nonNumber.error.detail).toContain('number');
      }
    });

    it('should maintain error context', () => {
      const result = TestIntegerVO.create(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error;
        expect(error.context).toBeDefined();
        expect(error.context?.operation).toBeDefined();
      }
    });
  });

  describe('Factory Function Interface', () => {
    it('should provide create method', () => {
      const IntegerVO = createIntegerVO({ name: 'Test', errors: mockErrors });
      expect(typeof IntegerVO.create).toBe('function');
    });

    it('should provide error factory functions', () => {
      expect(typeof mockErrors.type).toBe('function');
      expect(typeof mockErrors.tooSmall).toBe('function');
      expect(typeof mockErrors.tooLarge).toBe('function');
      expect(typeof mockErrors.negativeNotAllowed).toBe('function');
    });

    it('should maintain configuration consistency', () => {
      const config = {
        name: 'TestInteger',
        max: 50,
        errors: mockErrors,
      };

      const IntegerVO = createIntegerVO(config);

      // Should respect configuration
      const validResult = IntegerVO.create(25);
      const invalidResult = IntegerVO.create(51);

      expect(isOk(validResult)).toBe(true);
      expect(isErr(invalidResult)).toBe(true);
    });
  });

  describe('Required Configuration', () => {
    const RequiredIntegerVO = createIntegerVO({
      name: 'RequiredInteger',
      required: true,
      errors: mockErrors,
    });

    it('should reject undefined when required', () => {
      const result = RequiredIntegerVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const result = RequiredIntegerVO.create(null);
      expect(isErr(result)).toBe(true);
    });
  });
});
