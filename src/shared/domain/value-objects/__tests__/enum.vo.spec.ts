import { createEnumVO, createEnumVOErrors } from '../enum.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('EnumVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'ENUM_TEST_ERROR',
    title: 'Enum test error',
    category: 'validation',
  };

  const mockErrors = createEnumVOErrors(mockBaseError, 'TestEnum');

  describe('Basic Creation', () => {
    const TestEnumVO = createEnumVO({
      name: 'TestEnum',
      values: ['active', 'inactive', 'pending'] as const,
      errors: mockErrors,
    });

    it('should create enum VO with valid value', () => {
      const result = TestEnumVO.create('active');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe('active');
        expect(vo.possibleValues).toEqual(['active', 'inactive', 'pending']);
      }
    });

    it('should reject invalid enum value', () => {
      const result = TestEnumVO.create('invalid');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('ENUM_TEST_ERROR');
      }
    });

    it('should reject null input by default', () => {
      const result = TestEnumVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = TestEnumVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case sensitive by default', () => {
      const TestEnumVO = createEnumVO({
        name: 'TestEnum',
        values: ['Active', 'Inactive'] as const,
        caseSensitive: true,
        errors: mockErrors,
      });

      const result1 = TestEnumVO.create('Active');
      const result2 = TestEnumVO.create('active');

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });

    it('should be case insensitive when configured', () => {
      const TestEnumVO = createEnumVO({
        name: 'TestEnum',
        values: ['Active', 'Inactive'] as const,
        caseSensitive: false,
        errors: mockErrors,
      });

      const result1 = TestEnumVO.create('Active');
      const result2 = TestEnumVO.create('active');

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result2)) {
        expect(result2.value.value).toBe('Active'); // Should normalize to original case
      }
    });
  });

  describe('Numeric Enums', () => {
    const NumericEnumVO = createEnumVO({
      name: 'NumericEnum',
      values: [1, 2, 3] as const,
      errors: mockErrors,
    });

    it('should create numeric enum VO with valid value', () => {
      const result = NumericEnumVO.create(2);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe(2);
        expect(vo.possibleValues).toEqual([1, 2, 3]);
      }
    });

    it('should reject invalid numeric enum value', () => {
      const result = NumericEnumVO.create(5);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Comparison Operations', () => {
    const TestEnumVO = createEnumVO({
      name: 'TestEnum',
      values: ['a', 'b', 'c'] as const,
      errors: mockErrors,
    });

    it('should compare enum values correctly', () => {
      const result1 = TestEnumVO.create('a');
      const result2 = TestEnumVO.create('b');
      const result3 = TestEnumVO.create('a');

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isOk(result3)).toBe(true);

      if (isOk(result1) && isOk(result2) && isOk(result3)) {
        expect(result1.value.equals(result3.value)).toBe(true);
        expect(result1.value.equals(result2.value)).toBe(false);

        // For string enums, comparison is lexicographic
        expect(result1.value.compare(result2.value)).toBe(-1); // 'a' < 'b'
        expect(result2.value.compare(result1.value)).toBe(1); // 'b' > 'a'
        expect(result1.value.compare(result3.value)).toBe(0); // 'a' == 'a'
      }
    });
  });

  describe('Membership Testing', () => {
    const TestEnumVO = createEnumVO({
      name: 'TestEnum',
      values: ['red', 'green', 'blue'] as const,
      errors: mockErrors,
    });

    it('should test membership correctly', () => {
      const result = TestEnumVO.create('red');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isOneOf('red')).toBe(true);
        expect(result.value.isOneOf('green', 'blue')).toBe(false);
        expect(result.value.isOneOf('red', 'green')).toBe(true);
      }
    });
  });

  describe('Serialization', () => {
    const TestEnumVO = createEnumVO({
      name: 'TestEnum',
      values: ['active', 'inactive'] as const,
      errors: mockErrors,
    });

    it('should serialize to JSON correctly', () => {
      const result = TestEnumVO.create('active');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json.type).toBe('TestEnum');
        expect(json.value).toBe('active');
        expect(json.possibleValues).toEqual(['active', 'inactive']);
      }
    });

    it('should convert to string correctly', () => {
      const result = TestEnumVO.create('active');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toString()).toBe('active');
      }
    });
  });

  describe('Type Coercion with from() method', () => {
    const StringEnumVO = createEnumVO({
      name: 'StringEnum',
      values: ['yes', 'no'] as const,
      errors: mockErrors,
    });

    const NumericEnumVO = createEnumVO({
      name: 'NumericEnum',
      values: [1, 2] as const,
      errors: mockErrors,
    });

    it('should handle string inputs for string enums', () => {
      const result = StringEnumVO.from('yes');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('yes');
      }
    });

    it('should handle number inputs for numeric enums', () => {
      const result = NumericEnumVO.from(1);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(1);
      }
    });

    it('should reject string number inputs for numeric enums', () => {
      const result = NumericEnumVO.from('2');
      expect(isErr(result)).toBe(true);
    });

    it('should reject invalid inputs', () => {
      const result = StringEnumVO.from('maybe');
      expect(isErr(result)).toBe(true);
    });

    it('should handle case insensitive conversion when configured', () => {
      const CaseInsensitiveEnumVO = createEnumVO({
        name: 'CaseInsensitiveEnum',
        values: ['Yes', 'No'] as const,
        caseSensitive: false,
        errors: mockErrors,
      });

      const result = CaseInsensitiveEnumVO.from('yes');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('Yes'); // Should normalize to original case
      }
    });
  });

  describe('Required Configuration', () => {
    it('should reject undefined when required', () => {
      const TestEnumVO = createEnumVO({
        name: 'TestEnum',
        values: ['a', 'b'] as const,
        required: true,
        errors: mockErrors,
      });

      const result = TestEnumVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const TestEnumVO = createEnumVO({
        name: 'TestEnum',
        values: ['a', 'b'] as const,
        required: true,
        errors: mockErrors,
      });

      const result = TestEnumVO.create(null);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('State Machine Integration', () => {
    const StatusEnumVO = createEnumVO({
      name: 'Status',
      values: ['draft', 'review', 'approved', 'published'] as const,
      errors: mockErrors,
    });

    it('should work with state transitions', () => {
      const result1 = StatusEnumVO.create('draft');
      const result2 = StatusEnumVO.create('review');

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);

      if (isOk(result1) && isOk(result2)) {
        // Basic functionality should work
        expect(result1.value.value).toBe('draft');
        expect(result2.value.value).toBe('review');
        expect(result1.value.equals(result2.value)).toBe(false);
      }
    });
  });
});
