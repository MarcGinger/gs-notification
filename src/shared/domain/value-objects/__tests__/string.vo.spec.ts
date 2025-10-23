import { createStringVO, createStringVOErrors } from '../string.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('StringVO', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'TEST_ERROR',
    title: 'Test error',
    category: 'validation',
  };

  // Mock error factory
  const mockErrors = createStringVOErrors(mockBaseError, 'TestEntity');

  describe('Basic String VO Creation', () => {
    const BasicStringVO = createStringVO({
      name: 'BasicString',
      errors: mockErrors,
    });

    it('should create valid string VO with basic input', () => {
      const result = BasicStringVO.create('valid string');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo._value).toBe('valid string');
        expect(typeof vo.equals).toBe('function');
      }
    });

    it('should handle empty string based on configuration', () => {
      const result = BasicStringVO.create('');
      expect(isErr(result)).toBe(true); // Default allowEmpty is false
    });

    it('should handle null/undefined input', () => {
      const nullResult = BasicStringVO.create(null);
      const undefinedResult = BasicStringVO.create(undefined);

      expect(isErr(nullResult)).toBe(true);
      expect(isErr(undefinedResult)).toBe(true);
    });
  });

  describe('Length Validation', () => {
    const LengthConstrainedVO = createStringVO({
      name: 'LengthConstrained',
      minLength: 3,
      maxLength: 10,
      allowEmpty: false,
      errors: mockErrors,
    });

    it('should accept valid length strings', () => {
      const validResults = [
        LengthConstrainedVO.create('abc'), // min length
        LengthConstrainedVO.create('middle'), // middle range
        LengthConstrainedVO.create('1234567890'), // max length
      ];

      validResults.forEach((result) => {
        expect(isOk(result)).toBe(true);
      });
    });

    it('should reject strings below minimum length', () => {
      const result = LengthConstrainedVO.create('ab');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('at least');
      }
    });

    it('should reject strings above maximum length', () => {
      const result = LengthConstrainedVO.create('12345678901');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('cannot exceed');
      }
    });
  });

  describe('Pattern Validation', () => {
    const PatternVO = createStringVO({
      name: 'PatternString',
      pattern: /^[A-Z][a-z]+$/,
      errors: mockErrors,
    });

    it('should accept strings matching pattern', () => {
      const result = PatternVO.create('Valid');
      expect(isOk(result)).toBe(true);
    });

    it('should reject strings not matching pattern', () => {
      const invalidResults = [
        PatternVO.create('invalid'), // lowercase first
        PatternVO.create('INVALID'), // all uppercase
        PatternVO.create('Valid123'), // contains numbers
        PatternVO.create('Valid-name'), // contains hyphen
      ];

      invalidResults.forEach((result) => {
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.detail).toContain('format is invalid');
        }
      });
    });
  });

  describe('Case Transformation', () => {
    const UppercaseVO = createStringVO({
      name: 'UppercaseString',
      caseTransform: 'upper',
      errors: mockErrors,
    });

    const LowercaseVO = createStringVO({
      name: 'LowercaseString',
      caseTransform: 'lower',
      errors: mockErrors,
    });

    it('should transform to uppercase', () => {
      const result = UppercaseVO.create('mixed Case String');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe('MIXED CASE STRING');
      }
    });

    it('should transform to lowercase', () => {
      const result = LowercaseVO.create('Mixed Case String');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe('mixed case string');
      }
    });
  });

  describe('Trimming', () => {
    const TrimmedVO = createStringVO({
      name: 'TrimmedString',
      trim: true,
      errors: mockErrors,
    });

    it('should trim whitespace from both ends', () => {
      const result = TrimmedVO.create('  trimmed string  ');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe('trimmed string');
      }
    });

    it('should preserve internal whitespace', () => {
      const result = TrimmedVO.create('  multiple   internal   spaces  ');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe('multiple   internal   spaces');
      }
    });
  });

  describe('Complex Configuration', () => {
    const ComplexStringVO = createStringVO({
      name: 'ComplexString',
      minLength: 2,
      maxLength: 20,
      pattern: /^[A-Za-z][A-Za-z0-9_-]*$/,
      caseTransform: 'lower',
      trim: true,
      errors: mockErrors,
    });

    it('should apply all transformations and validations', () => {
      const result = ComplexStringVO.create('  Valid_Name-123  ');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe('valid_name-123');
      }
    });

    it('should validate after transformation', () => {
      const result = ComplexStringVO.create('  A  '); // After trim becomes 'A', fails min length
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Value Object Behavior', () => {
    const TestStringVO = createStringVO({
      name: 'TestString',
      errors: mockErrors,
    });

    it('should implement equals method correctly', () => {
      const result1 = TestStringVO.create('same value');
      const result2 = TestStringVO.create('same value');
      const result3 = TestStringVO.create('different value');

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isOk(result3)).toBe(true);

      if (isOk(result1) && isOk(result2) && isOk(result3)) {
        expect(result1.value.equals(result2.value)).toBe(true);
        expect(result1.value.equals(result3.value)).toBe(false);
      }
    });

    it('should provide consistent toString behavior', () => {
      const result = TestStringVO.create('test value');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toString()).toBe('test value');
      }
    });

    it('should provide value property access', () => {
      const testValue = 'test string value';
      const result = TestStringVO.create(testValue);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe(testValue);
      }
    });
  });

  describe('Error Handling', () => {
    const TestStringVO = createStringVO({
      name: 'TestString',
      minLength: 5,
      maxLength: 10,
      pattern: /^[A-Z]+$/,
      errors: mockErrors,
    });

    it('should provide detailed error messages', () => {
      const tooShort = TestStringVO.create('ABC');
      const tooLong = TestStringVO.create('ABCDEFGHIJKLMN');
      const invalidPattern = TestStringVO.create('abc123');

      expect(isErr(tooShort)).toBe(true);
      if (isErr(tooShort)) {
        expect(tooShort.error.detail).toContain('at least');
      }

      expect(isErr(tooLong)).toBe(true);
      if (isErr(tooLong)) {
        expect(tooLong.error.detail).toContain('cannot exceed');
      }

      expect(isErr(invalidPattern)).toBe(true);
      if (isErr(invalidPattern)) {
        expect(invalidPattern.error.detail).toContain('format is invalid');
      }
    });

    it('should maintain error context', () => {
      const result = TestStringVO.create('invalid');
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
      const StringVO = createStringVO({ name: 'Test', errors: mockErrors });
      expect(typeof StringVO.create).toBe('function');
    });

    it('should provide error factory functions', () => {
      expect(typeof mockErrors.required).toBe('function');
      expect(typeof mockErrors.tooShort).toBe('function');
      expect(typeof mockErrors.tooLong).toBe('function');
      expect(typeof mockErrors.pattern).toBe('function');
    });

    it('should maintain configuration consistency', () => {
      const config = {
        name: 'TestString',
        maxLength: 50,
        errors: mockErrors,
      };

      const StringVO = createStringVO(config);

      // Should respect configuration
      const validResult = StringVO.create('Valid string under 50 chars');
      const invalidResult = StringVO.create('x'.repeat(51));

      expect(isOk(validResult)).toBe(true);
      expect(isErr(invalidResult)).toBe(true);
    });
  });

  describe('Allow Empty Configuration', () => {
    const AllowEmptyVO = createStringVO({
      name: 'AllowEmptyString',
      allowEmpty: true,
      errors: mockErrors,
    });

    it('should accept empty strings when allowEmpty is true', () => {
      const result = AllowEmptyVO.create('');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value._value).toBe('');
      }
    });
  });

  describe('Required Configuration', () => {
    const RequiredVO = createStringVO({
      name: 'RequiredString',
      required: true,
      errors: mockErrors,
    });

    it('should reject undefined when required', () => {
      const result = RequiredVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const result = RequiredVO.create(null);
      expect(isErr(result)).toBe(true);
    });

    it('should reject empty string when required', () => {
      const result = RequiredVO.create('');
      expect(isErr(result)).toBe(true);
    });
  });
});
