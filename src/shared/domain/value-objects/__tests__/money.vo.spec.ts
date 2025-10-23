import { createMoneyVO, createMoneyVOErrors } from '../money.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('MoneyVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'MONEY_TEST_ERROR',
    title: 'Money test error',
    category: 'validation',
  };

  const mockErrors = createMoneyVOErrors(mockBaseError, 'TestMoney');

  describe('Basic Creation', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should create money VO with valid amount', () => {
      const result = TestMoneyVO.create(100.5);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(100.5);
        expect(vo.currency).toBe('USD');
        expect(vo.isZero).toBe(false);
        expect(vo.isPositive).toBe(true);
        expect(vo.isNegative).toBe(false);
      }
    });

    it('should create money VO with zero amount', () => {
      const result = TestMoneyVO.create(0);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(0);
        expect(result.value.isZero).toBe(true);
        expect(result.value.isPositive).toBe(false);
        expect(result.value.isNegative).toBe(false);
      }
    });

    it('should create money VO with negative amount', () => {
      const result = TestMoneyVO.create(-50.25);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(-50.25);
        expect(result.value.isNegative).toBe(true);
        expect(result.value.isPositive).toBe(false);
      }
    });

    it('should reject non-finite numbers', () => {
      const result1 = TestMoneyVO.create(Infinity);
      const result2 = TestMoneyVO.create(NaN);

      expect(isErr(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });

    it('should reject null input by default', () => {
      const result = TestMoneyVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = TestMoneyVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Range Validation', () => {
    it('should enforce minimum value', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        min: 10,
        errors: mockErrors,
      });

      const result1 = TestMoneyVO.create(15);
      const result2 = TestMoneyVO.create(5);

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });

    it('should enforce maximum value', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        max: 100,
        errors: mockErrors,
      });

      const result1 = TestMoneyVO.create(50);
      const result2 = TestMoneyVO.create(150);

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });

    it('should enforce both min and max', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        min: 10,
        max: 100,
        errors: mockErrors,
      });

      const result1 = TestMoneyVO.create(50);
      const result2 = TestMoneyVO.create(5);
      const result3 = TestMoneyVO.create(150);

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
      expect(isErr(result3)).toBe(true);
    });
  });

  describe('Sign Restrictions', () => {
    it('should reject negative amounts when not allowed', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        allowNegative: false,
        errors: mockErrors,
      });

      const result1 = TestMoneyVO.create(50);
      const result2 = TestMoneyVO.create(-10);

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });

    it('should reject zero when not allowed', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        allowZero: false,
        errors: mockErrors,
      });

      const result1 = TestMoneyVO.create(50);
      const result2 = TestMoneyVO.create(0);

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });
  });

  describe('Currency Formatting', () => {
    it('should format USD correctly', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        errors: mockErrors,
      });

      const result = TestMoneyVO.create(1234.56);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.formatted).toBe('$1234.56');
        expect(result.value.toString()).toBe('$1234.56');
      }
    });

    it('should format EUR correctly', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'EUR',
        errors: mockErrors,
      });

      const result = TestMoneyVO.create(1234.56);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.formatted).toBe('1234.56€');
      }
    });

    it('should format JPY correctly (no decimals)', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'JPY',
        errors: mockErrors,
      });

      const result = TestMoneyVO.create(1234.56);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.formatted).toBe('¥1235');
      }
    });
  });

  describe('Arithmetic Operations', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should add money values correctly', () => {
      const result1 = TestMoneyVO.create(100);
      const result2 = TestMoneyVO.create(50);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        const sumResult = result1.value.add(result2.value);
        expect(isOk(sumResult)).toBe(true);
        if (isOk(sumResult)) {
          expect(sumResult.value.value).toBe(150);
        }
      }
    });

    it('should subtract money values correctly', () => {
      const result1 = TestMoneyVO.create(100);
      const result2 = TestMoneyVO.create(30);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        const diffResult = result1.value.subtract(result2.value);
        expect(isOk(diffResult)).toBe(true);
        if (isOk(diffResult)) {
          expect(diffResult.value.value).toBe(70);
        }
      }
    });

    it('should multiply by factor correctly', () => {
      const result = TestMoneyVO.create(100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const productResult = result.value.multiply(1.5);
        expect(isOk(productResult)).toBe(true);
        if (isOk(productResult)) {
          expect(productResult.value.value).toBe(150);
        }
      }
    });

    it('should divide by divisor correctly', () => {
      const result = TestMoneyVO.create(100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const quotientResult = result.value.divide(4);
        expect(isOk(quotientResult)).toBe(true);
        if (isOk(quotientResult)) {
          expect(quotientResult.value.value).toBe(25);
        }
      }
    });

    it('should reject division by zero', () => {
      const result = TestMoneyVO.create(100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const divisionResult = result.value.divide(0);
        expect(isErr(divisionResult)).toBe(true);
      }
    });

    it('should reject operations with different currencies', () => {
      const USDVO = createMoneyVO({
        name: 'USD',
        currency: 'USD',
        errors: mockErrors,
      });

      const EURVO = createMoneyVO({
        name: 'EUR',
        currency: 'EUR',
        errors: mockErrors,
      });

      const usdResult = USDVO.create(100);
      const eurResult = EURVO.create(50);

      expect(isOk(usdResult)).toBe(true);
      expect(isOk(eurResult)).toBe(true);

      if (isOk(usdResult) && isOk(eurResult)) {
        // Type assertion to bypass TypeScript for testing currency mismatch
        const addResult = usdResult.value.add(
          eurResult.value as unknown as typeof usdResult.value,
        );
        expect(isErr(addResult)).toBe(true);
      }
    });
  });

  describe('Unary Operations', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should calculate absolute value correctly', () => {
      const result = TestMoneyVO.create(-50);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const absResult = result.value.abs();
        expect(isOk(absResult)).toBe(true);
        if (isOk(absResult)) {
          expect(absResult.value.value).toBe(50);
        }
      }
    });

    it('should negate value correctly', () => {
      const result = TestMoneyVO.create(75);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const negateResult = result.value.negate();
        expect(isOk(negateResult)).toBe(true);
        if (isOk(negateResult)) {
          expect(negateResult.value.value).toBe(-75);
        }
      }
    });

    it('should round to default decimal places', () => {
      const result = TestMoneyVO.create(123.456);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const roundResult = result.value.round();
        expect(isOk(roundResult)).toBe(true);
        if (isOk(roundResult)) {
          expect(roundResult.value.value).toBe(123.46);
        }
      }
    });

    it('should round to specified decimal places', () => {
      const result = TestMoneyVO.create(123.456);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const roundResult = result.value.round(1);
        expect(isOk(roundResult)).toBe(true);
        if (isOk(roundResult)) {
          expect(roundResult.value.value).toBe(123.5);
        }
      }
    });
  });

  describe('Money Allocation', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should allocate money across ratios correctly', () => {
      const result = TestMoneyVO.create(100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const allocationResult = result.value.allocate([1, 2, 3]);
        expect(isOk(allocationResult)).toBe(true);
        if (isOk(allocationResult)) {
          const allocations = allocationResult.value;
          expect(allocations).toHaveLength(3);
          expect(allocations[0].value).toBe(16.67); // 100 * (1/6) ≈ 16.666..., rounded to 16.67
          expect(allocations[1].value).toBe(33.33); // 100 * (2/6) ≈ 33.333..., rounded to 33.33
          expect(allocations[2].value).toBe(50); // Remainder: 100 - 16.67 - 33.33 = 50
        }
      }
    });

    it('should handle empty ratios array', () => {
      const result = TestMoneyVO.create(100);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const allocationResult = result.value.allocate([]);
        expect(isErr(allocationResult)).toBe(true);
      }
    });
  });

  describe('Comparison Operations', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should compare money values correctly', () => {
      const result1 = TestMoneyVO.create(100);
      const result2 = TestMoneyVO.create(200);
      const result3 = TestMoneyVO.create(100);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isOk(result3)).toBe(true);

      if (isOk(result1) && isOk(result2) && isOk(result3)) {
        expect(result1.value.equals(result3.value)).toBe(true);
        expect(result1.value.equals(result2.value)).toBe(false);

        expect(result1.value.compare(result2.value)).toBe(-1);
        expect(result2.value.compare(result1.value)).toBe(1);
        expect(result1.value.compare(result3.value)).toBe(0);

        expect(result1.value.lessThan(result2.value)).toBe(true);
        expect(result2.value.greaterThan(result1.value)).toBe(true);
      }
    });

    it('should throw error when comparing different currencies', () => {
      const USDVO = createMoneyVO({
        name: 'USD',
        currency: 'USD',
        errors: mockErrors,
      });

      const EURVO = createMoneyVO({
        name: 'EUR',
        currency: 'EUR',
        errors: mockErrors,
      });

      const usdResult = USDVO.create(100);
      const eurResult = EURVO.create(100);

      expect(isOk(usdResult)).toBe(true);
      expect(isOk(eurResult)).toBe(true);

      if (isOk(usdResult) && isOk(eurResult)) {
        expect(() =>
          usdResult.value.compare(
            eurResult.value as unknown as typeof usdResult.value,
          ),
        ).toThrow();
        expect(() =>
          usdResult.value.greaterThan(
            eurResult.value as unknown as typeof usdResult.value,
          ),
        ).toThrow();
        expect(() =>
          usdResult.value.lessThan(
            eurResult.value as unknown as typeof usdResult.value,
          ),
        ).toThrow();
      }
    });
  });

  describe('Serialization', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should serialize to JSON correctly', () => {
      const result = TestMoneyVO.create(123.45);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json.value).toBe(123.45);
        expect(json.currency).toBe('USD');
        expect(json.type).toBe('TestMoney');
      }
    });
  });

  describe('Type Coercion with from() method', () => {
    const TestMoneyVO = createMoneyVO({
      name: 'TestMoney',
      currency: 'USD',
      errors: mockErrors,
    });

    it('should handle number inputs', () => {
      const result = TestMoneyVO.from(123.45);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(123.45);
      }
    });

    it('should handle valid string number inputs', () => {
      const result = TestMoneyVO.from('123.45');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(123.45);
      }
    });

    it('should reject invalid string inputs', () => {
      const result = TestMoneyVO.from('not-a-number');
      expect(isErr(result)).toBe(true);
    });

    it('should reject non-number/non-string inputs', () => {
      const result = TestMoneyVO.from({});
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Required Configuration', () => {
    it('should reject undefined when required', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        required: true,
        errors: mockErrors,
      });

      const result = TestMoneyVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        required: true,
        errors: mockErrors,
      });

      const result = TestMoneyVO.create(null);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Precision and Scale', () => {
    it('should apply precision and scale during creation', () => {
      const TestMoneyVO = createMoneyVO({
        name: 'TestMoney',
        currency: 'USD',
        precision: 10,
        scale: 2,
        errors: mockErrors,
      });

      const result = TestMoneyVO.create(123.456);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(123.46);
      }
    });
  });
});
