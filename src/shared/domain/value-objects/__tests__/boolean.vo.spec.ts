/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { createBooleanVO, createBooleanVOErrors } from '../boolean.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('BooleanVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'BOOLEAN_TEST_ERROR',
    title: 'Boolean test error',
    category: 'validation',
  };

  const mockErrors = createBooleanVOErrors(mockBaseError, 'TestBoolean');

  describe('Basic Creation', () => {
    const BooleanVO = createBooleanVO({
      name: 'TestBoolean',
      errors: mockErrors,
    });

    it('should create boolean VO with true value', () => {
      const result = BooleanVO.create(true);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(true);
        expect(vo.isTrue).toBe(true);
        expect(vo.isFalse).toBe(false);
      }
    });

    it('should create boolean VO with false value', () => {
      const result = BooleanVO.create(false);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(false);
        expect(vo.isTrue).toBe(false);
        expect(vo.isFalse).toBe(true);
      }
    });

    it('should reject null input by default', () => {
      const result = BooleanVO.create(null);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('must be a boolean');
      }
    });

    it('should reject undefined input by default', () => {
      const result = BooleanVO.create(undefined);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('must be a boolean');
      }
    });
  });

  describe('Type Coercion with from() method', () => {
    const BooleanVO = createBooleanVO({
      name: 'TestBoolean',
      errors: mockErrors,
    });

    it('should convert string "true" to true', () => {
      const result = BooleanVO.from('true');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(true);
      }
    });

    it('should convert string "false" to false', () => {
      const result = BooleanVO.from('false');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(false);
      }
    });

    it('should convert number 1 to true', () => {
      const result = BooleanVO.from(1);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(true);
      }
    });

    it('should convert number 0 to false', () => {
      const result = BooleanVO.from(0);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(false);
      }
    });

    it('should handle case-insensitive string conversion', () => {
      const trueResult = BooleanVO.from('TRUE');
      const falseResult = BooleanVO.from('FALSE');

      expect(isOk(trueResult)).toBe(true);
      expect(isOk(falseResult)).toBe(true);

      if (isOk(trueResult) && isOk(falseResult)) {
        expect(trueResult.value._value).toBe(true);
        expect(falseResult.value._value).toBe(false);
      }
    });

    it('should reject invalid string values', () => {
      const result = BooleanVO.from('invalid');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('invalid value');
      }
    });

    it('should handle various truthy string representations', () => {
      const truthyStrings = [
        'true',
        'TRUE',
        'True',
        '1',
        'yes',
        'YES',
        'on',
        'ON',
      ];

      truthyStrings.forEach((str) => {
        const result = BooleanVO.from(str);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(true);
        }
      });
    });

    it('should handle various falsy string representations', () => {
      const falsyStrings = [
        'false',
        'FALSE',
        'False',
        '0',
        'no',
        'NO',
        'off',
        'OFF',
      ];

      falsyStrings.forEach((str) => {
        const result = BooleanVO.from(str);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.value).toBe(false);
        }
      });
    });

    it('should handle whitespace in string inputs', () => {
      const result1 = BooleanVO.from('  true  ');
      const result2 = BooleanVO.from('  false  ');

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        expect(result1.value.value).toBe(true);
        expect(result2.value.value).toBe(false);
      }
    });

    it('should reject invalid number inputs', () => {
      const invalidNumbers = [2, -1, 3.14, NaN];

      invalidNumbers.forEach((num) => {
        const result = BooleanVO.from(num);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.detail).toContain('invalid value');
        }
      });
    });
  });

  describe('Boolean Operations', () => {
    const BooleanVO = createBooleanVO({
      name: 'TestBoolean',
      errors: mockErrors,
    });

    let trueVO: any, falseVO: any;

    beforeEach(() => {
      const trueResult = BooleanVO.create(true);
      const falseResult = BooleanVO.create(false);

      expect(isOk(trueResult)).toBe(true);
      expect(isOk(falseResult)).toBe(true);

      if (isOk(trueResult) && isOk(falseResult)) {
        trueVO = trueResult.value;
        falseVO = falseResult.value;
      }
    });

    it('should perform logical AND operations', () => {
      const trueAndTrue = trueVO.and(trueVO);
      const trueAndFalse = trueVO.and(falseVO);
      const falseAndFalse = falseVO.and(falseVO);

      expect(isOk(trueAndTrue)).toBe(true);
      expect(isOk(trueAndFalse)).toBe(true);
      expect(isOk(falseAndFalse)).toBe(true);

      if (isOk(trueAndTrue)) {
        expect((trueAndTrue.value as any)._value).toBe(true);
      }
      if (isOk(trueAndFalse)) {
        expect((trueAndFalse.value as any)._value).toBe(false);
      }
      if (isOk(falseAndFalse)) {
        expect((falseAndFalse.value as any)._value).toBe(false);
      }
    });

    it('should perform logical OR operations', () => {
      const trueOrTrue = trueVO.or(trueVO);
      const trueOrFalse = trueVO.or(falseVO);
      const falseOrFalse = falseVO.or(falseVO);

      expect(isOk(trueOrTrue) && (trueOrTrue.value as any)._value).toBe(true);
      expect(isOk(trueOrFalse) && (trueOrFalse.value as any)._value).toBe(true);
      expect(isOk(falseOrFalse) && (falseOrFalse.value as any)._value).toBe(
        false,
      );
    });

    it('should perform logical NOT operations', () => {
      const notTrue = trueVO.not();
      const notFalse = falseVO.not();

      expect(isOk(notTrue) && (notTrue.value as any)._value).toBe(false);
      expect(isOk(notFalse) && (notFalse.value as any)._value).toBe(true);
    });

    it('should perform logical XOR operations', () => {
      const trueXorTrue = trueVO.xor(trueVO);
      const trueXorFalse = trueVO.xor(falseVO);

      expect(isOk(trueXorTrue) && (trueXorTrue.value as any)._value).toBe(
        false,
      );
      expect(isOk(trueXorFalse) && (trueXorFalse.value as any)._value).toBe(
        true,
      );
    });
  });

  describe('Comparison and Serialization', () => {
    const BooleanVO = createBooleanVO({
      name: 'TestBoolean',
      errors: mockErrors,
    });

    it('should check equality correctly', () => {
      const true1 = BooleanVO.create(true);
      const true2 = BooleanVO.create(true);
      const false1 = BooleanVO.create(false);

      expect(isOk(true1) && isOk(true2) && isOk(false1)).toBe(true);

      if (isOk(true1) && isOk(true2) && isOk(false1)) {
        expect(true1.value.equals(true2.value)).toBe(true);
        expect(true1.value.equals(false1.value)).toBe(false);
      }
    });

    it('should convert to string correctly', () => {
      const trueVO = BooleanVO.create(true);
      const falseVO = BooleanVO.create(false);

      expect(isOk(trueVO) && isOk(falseVO)).toBe(true);

      if (isOk(trueVO) && isOk(falseVO)) {
        expect(trueVO.value.toString()).toBe('true');
        expect(falseVO.value.toString()).toBe('false');
      }
    });

    it('should convert to JSON correctly', () => {
      const trueVO = BooleanVO.create(true);

      expect(isOk(trueVO)).toBe(true);

      if (isOk(trueVO)) {
        const json = trueVO.value.toJSON();
        expect(json).toEqual({
          value: true,
          type: 'TestBoolean',
        });
      }
    });
  });

  describe('Configuration Options', () => {
    it('should handle treatNullAsFalse configuration', () => {
      const LenientBooleanVO = createBooleanVO({
        name: 'LenientBoolean',
        treatNullAsFalse: true,
        defaultValue: false,
        errors: mockErrors,
      });

      const nullResult = LenientBooleanVO.from(null);
      const undefinedResult = LenientBooleanVO.from(undefined);

      expect(isOk(nullResult)).toBe(true);
      expect(isOk(undefinedResult)).toBe(true);

      if (isOk(nullResult) && isOk(undefinedResult)) {
        expect(nullResult.value.value).toBe(false);
        expect(undefinedResult.value.value).toBe(false);
      }
    });

    it('should handle defaultValue configuration', () => {
      const DefaultTrueBooleanVO = createBooleanVO({
        name: 'DefaultTrueBoolean',
        treatNullAsFalse: true,
        defaultValue: true,
        errors: mockErrors,
      });

      const nullResult = DefaultTrueBooleanVO.from(null);

      expect(isOk(nullResult)).toBe(true);
      if (isOk(nullResult)) {
        expect(nullResult.value.value).toBe(true);
      }
    });

    it('should reject null/undefined when treatNullAsFalse is false', () => {
      const StrictBooleanVO = createBooleanVO({
        name: 'StrictBoolean',
        treatNullAsFalse: false,
        errors: mockErrors,
      });

      const nullResult = StrictBooleanVO.from(null);
      const undefinedResult = StrictBooleanVO.from(undefined);

      expect(isErr(nullResult)).toBe(true);
      expect(isErr(undefinedResult)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    const BooleanVO = createBooleanVO({
      name: 'TestBoolean',
      errors: mockErrors,
    });

    it('should handle type errors with context', () => {
      const result = BooleanVO.create('not-boolean' as any);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.context).toHaveProperty('operation', 'type_check');
        expect(result.error.context).toHaveProperty('expected', 'boolean');
        expect(result.error.context).toHaveProperty('received', 'string');
      }
    });

    it('should handle required validation', () => {
      const RequiredBooleanVO = createBooleanVO({
        name: 'RequiredBoolean',
        required: true,
        errors: mockErrors,
      });

      const result = RequiredBooleanVO.create(null);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('is required');
      }
    });
  });
});
