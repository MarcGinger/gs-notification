import { createDecimalVO, createDecimalVOErrors } from '../decimal.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('DecimalVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'DECIMAL_TEST_ERROR',
    title: 'Decimal test error',
    category: 'validation',
  };

  const mockErrors = createDecimalVOErrors(mockBaseError, 'TestDecimal');

  describe('Basic Creation', () => {
    const DecimalVO = createDecimalVO({
      name: 'TestDecimal',
      errors: mockErrors,
    });

    it('should create decimal VO with valid number', () => {
      const result = DecimalVO.create(123.45);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(123.45);
        expect(vo.isZero).toBe(false);
        expect(vo.isPositive).toBe(true);
        expect(vo.isNegative).toBe(false);
        expect(vo.isInteger).toBe(false);
        expect(vo.decimalPlaces).toBe(2);
      }
    });

    it('should create decimal VO with integer', () => {
      const result = DecimalVO.create(42);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(42);
        expect(vo.isInteger).toBe(true);
        expect(vo.decimalPlaces).toBe(0);
      }
    });

    it('should create decimal VO with zero', () => {
      const result = DecimalVO.create(0);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(0);
        expect(vo.isZero).toBe(true);
        expect(vo.isPositive).toBe(false);
        expect(vo.isNegative).toBe(false);
      }
    });

    it('should create decimal VO with negative number', () => {
      const result = DecimalVO.create(-15.75);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(-15.75);
        expect(vo.isNegative).toBe(true);
        expect(vo.isPositive).toBe(false);
      }
    });

    it('should reject null input by default', () => {
      const result = DecimalVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = DecimalVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Range Validation', () => {
    it('should accept values within min/max range', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        min: 0,
        max: 100,
        errors: mockErrors,
      });

      const result = DecimalVO.create(50.5);
      expect(isOk(result)).toBe(true);
    });

    it('should reject values below minimum', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        min: 10,
        errors: mockErrors,
      });

      const result = DecimalVO.create(5);
      expect(isErr(result)).toBe(true);
    });

    it('should reject values above maximum', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        max: 100,
        errors: mockErrors,
      });

      const result = DecimalVO.create(150);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Decimal Places Validation', () => {
    it('should accept values within decimal places limit', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        maxDecimalPlaces: 2,
        errors: mockErrors,
      });

      const result = DecimalVO.create(12.34);
      expect(isOk(result)).toBe(true);
    });

    it('should reject values exceeding decimal places limit', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        maxDecimalPlaces: 2,
        errors: mockErrors,
      });

      const result = DecimalVO.create(12.345);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Arithmetic Operations', () => {
    const DecimalVO = createDecimalVO({
      name: 'TestDecimal',
      errors: mockErrors,
    });

    it('should add decimals correctly', () => {
      const result1 = DecimalVO.create(10.5);
      const result2 = DecimalVO.create(5.25);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        const addResult = result1.value.add(result2.value);
        expect(isOk(addResult)).toBe(true);

        if (isOk(addResult)) {
          expect(addResult.value.value).toBe(15.75);
        }
      }
    });

    it('should subtract decimals correctly', () => {
      const result1 = DecimalVO.create(20.5);
      const result2 = DecimalVO.create(5.25);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        const subtractResult = result1.value.subtract(result2.value);
        expect(isOk(subtractResult)).toBe(true);

        if (isOk(subtractResult)) {
          expect(subtractResult.value.value).toBe(15.25);
        }
      }
    });

    it('should multiply decimals correctly', () => {
      const result1 = DecimalVO.create(10.5);
      const result2 = DecimalVO.create(2);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        const multiplyResult = result1.value.multiply(result2.value);
        expect(isOk(multiplyResult)).toBe(true);

        if (isOk(multiplyResult)) {
          expect(multiplyResult.value.value).toBe(21);
        }
      }
    });

    it('should divide decimals correctly', () => {
      const result1 = DecimalVO.create(10);
      const result2 = DecimalVO.create(4);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        const divideResult = result1.value.divide(result2.value);
        expect(isOk(divideResult)).toBe(true);

        if (isOk(divideResult)) {
          expect(divideResult.value.value).toBe(2.5);
        }
      }
    });
  });

  describe('Rounding Operations', () => {
    const DecimalVO = createDecimalVO({
      name: 'TestDecimal',
      errors: mockErrors,
    });

    it('should round to specified decimal places', () => {
      const result = DecimalVO.create(12.3456);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const roundResult = result.value.round(2);
        expect(isOk(roundResult)).toBe(true);

        if (isOk(roundResult)) {
          expect(roundResult.value.value).toBe(12.35);
        }
      }
    });

    it('should ceil correctly', () => {
      const result = DecimalVO.create(12.1);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const ceilResult = result.value.ceil();
        expect(isOk(ceilResult)).toBe(true);

        if (isOk(ceilResult)) {
          expect(ceilResult.value.value).toBe(13);
        }
      }
    });

    it('should floor correctly', () => {
      const result = DecimalVO.create(12.9);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const floorResult = result.value.floor();
        expect(isOk(floorResult)).toBe(true);

        if (isOk(floorResult)) {
          expect(floorResult.value.value).toBe(12);
        }
      }
    });

    it('should truncate correctly', () => {
      const result = DecimalVO.create(12.9);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const truncateResult = result.value.truncate();
        expect(isOk(truncateResult)).toBe(true);

        if (isOk(truncateResult)) {
          expect(truncateResult.value.value).toBe(12);
        }
      }
    });
  });

  describe('Comparison Operations', () => {
    const DecimalVO = createDecimalVO({
      name: 'TestDecimal',
      errors: mockErrors,
    });

    it('should compare decimals correctly', () => {
      const result1 = DecimalVO.create(10.5);
      const result2 = DecimalVO.create(5.25);
      const result3 = DecimalVO.create(10.5);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isOk(result3)).toBe(true);

      if (isOk(result1) && isOk(result2) && isOk(result3)) {
        expect(result1.value.greaterThan(result2.value)).toBe(true);
        expect(result2.value.lessThan(result1.value)).toBe(true);
        expect(result1.value.equals(result3.value)).toBe(true);
        expect(result1.value.compare(result2.value)).toBe(1);
        expect(result2.value.compare(result1.value)).toBe(-1);
        expect(result1.value.compare(result3.value)).toBe(0);
      }
    });
  });

  describe('Serialization', () => {
    const DecimalVO = createDecimalVO({
      name: 'TestDecimal',
      errors: mockErrors,
    });

    it('should convert to string correctly', () => {
      const result = DecimalVO.create(123.45);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toString()).toBe('123.45');
      }
    });

    it('should convert to fixed decimal places', () => {
      const result = DecimalVO.create(123.456);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toFixed(2)).toBe('123.46');
        expect(result.value.toFixed(0)).toBe('123');
      }
    });
  });

  describe('Type Coercion with from() method', () => {
    const DecimalVO = createDecimalVO({
      name: 'TestDecimal',
      errors: mockErrors,
    });

    it('should handle number inputs', () => {
      const result = DecimalVO.from(123.45);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(123.45);
      }
    });

    it('should handle string number inputs', () => {
      const result = DecimalVO.from('123.45');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(123.45);
      }
    });

    it('should reject invalid string inputs', () => {
      const result = DecimalVO.from('not-a-number');
      expect(isErr(result)).toBe(true);
    });

    it('should handle bigint inputs', () => {
      const result = DecimalVO.from(BigInt(123));

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(123);
      }
    });
  });

  describe('Required Configuration', () => {
    it('should reject undefined when required', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        required: true,
        errors: mockErrors,
      });

      const result = DecimalVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const DecimalVO = createDecimalVO({
        name: 'TestDecimal',
        required: true,
        errors: mockErrors,
      });

      const result = DecimalVO.create(null);
      expect(isErr(result)).toBe(true);
    });
  });
});
