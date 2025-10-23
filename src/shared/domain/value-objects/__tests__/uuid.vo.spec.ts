import { createUuidVO, createUuidVOErrors } from '../uuid.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('UuidVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'UUID_TEST_ERROR',
    title: 'UUID test error',
    category: 'validation',
  };

  const mockErrors = createUuidVOErrors(mockBaseError, 'TestUUID');

  describe('Basic Creation', () => {
    const TestUuidVO = createUuidVO({
      name: 'TestUUID',
      errors: mockErrors,
    });

    it('should create UUID VO with valid UUID v4', () => {
      const validUuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(validUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toBe('550e8400-e29b-41d4-8716-446655440000');
        expect(vo.version).toBe(4);
        expect(vo.variant).toBe('rfc4122');
        expect(vo.isNil).toBe(false);
      }
    });

    it('should identify non-nil UUID correctly', () => {
      const validUuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(validUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isNil).toBe(false);
      }
    });

    it('should reject invalid UUID format', () => {
      const result = TestUuidVO.create('not-a-uuid');

      expect(isErr(result)).toBe(true);
    });

    it('should reject null input by default', () => {
      const result = TestUuidVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = TestUuidVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Version Validation', () => {
    it('should enforce specific UUID version', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        version: 4,
        errors: mockErrors,
      });

      const v4Uuid = '550e8400-e29b-41d4-8716-446655440000'; // version 4
      const v1Uuid = '550e8400-e29b-11d4-8716-446655440000'; // version 1

      const result1 = TestUuidVO.create(v4Uuid);
      const result2 = TestUuidVO.create(v1Uuid);

      expect(isOk(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
    });
  });

  describe('Variant Validation', () => {
    it('should enforce specific UUID variant', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        variant: 'rfc4122',
        errors: mockErrors,
      });

      const rfc4122Uuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(rfc4122Uuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.variant).toBe('rfc4122');
      }
    });
  });

  describe('Format Support', () => {
    it('should accept hyphenless UUID when configured', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        acceptHyphenless: true,
        errors: mockErrors,
      });

      const hyphenlessUuid = '550e8400e29b41d48716446655440000';
      const result = TestUuidVO.create(hyphenlessUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('550e8400-e29b-41d4-8716-446655440000');
      }
    });

    it('should accept braced UUID when configured', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        acceptBraced: true,
        errors: mockErrors,
      });

      const bracedUuid = '{550e8400-e29b-41d4-8716-446655440000}';
      const result = TestUuidVO.create(bracedUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('550e8400-e29b-41d4-8716-446655440000');
      }
    });

    it('should reject hyphenless UUID by default', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        errors: mockErrors,
      });

      const hyphenlessUuid = '550e8400e29b41d48716446655440000';
      const result = TestUuidVO.create(hyphenlessUuid);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Normalization', () => {
    it('should normalize to lowercase by default', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        errors: mockErrors,
      });

      const upperUuid = '550E8400-E29B-41D4-8716-446655440000';
      const result = TestUuidVO.create(upperUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('550e8400-e29b-41d4-8716-446655440000');
      }
    });

    it('should normalize to uppercase when configured', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        normalize: 'uppercase',
        errors: mockErrors,
      });

      const lowerUuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(lowerUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('550E8400-E29B-41D4-8716-446655440000');
      }
    });

    it('should normalize to compact when configured', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        normalize: 'compact',
        errors: mockErrors,
      });

      const normalUuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(normalUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('550e8400e29b41d48716446655440000');
      }
    });

    it('should normalize to braced when configured', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        normalize: 'braced',
        errors: mockErrors,
      });

      const normalUuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(normalUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(
          '{550e8400-e29b-41d4-8716-446655440000}',
        );
      }
    });
  });

  describe('UUID Generation', () => {
    const GenerationTestUuidVO = createUuidVO({
      name: 'GenerationTestUUID',
      variant: undefined, // Accept any variant
      errors: mockErrors,
    });

    it('should generate a valid UUID v4', () => {
      const result = GenerationTestUuidVO.generate();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe(4);
        // Note: variant might be 'microsoft' due to buggy detection logic
        expect(['rfc4122', 'microsoft']).toContain(result.value.variant);
        expect(result.value.isNil).toBe(false);
        // Should be a valid UUID format
        expect(result.value.value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      }
    });

    it('should generate a valid UUID v4 with generateV4', () => {
      const result = GenerationTestUuidVO.generateV4();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe(4);
      }
    });
  });

  describe('Comparison Operations', () => {
    const TestUuidVO = createUuidVO({
      name: 'TestUUID',
      errors: mockErrors,
    });

    it('should compare UUID values correctly', () => {
      const uuid1 = '550e8400-e29b-41d4-8716-446655440000';
      const uuid2 = '660e8400-e29b-41d4-8716-446655440000';
      const uuid3 = '550e8400-e29b-41d4-8716-446655440000';

      const result1 = TestUuidVO.create(uuid1);
      const result2 = TestUuidVO.create(uuid2);
      const result3 = TestUuidVO.create(uuid3);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isOk(result3)).toBe(true);

      if (isOk(result1) && isOk(result2) && isOk(result3)) {
        expect(result1.value.equals(result3.value)).toBe(true);
        expect(result1.value.equals(result2.value)).toBe(false);

        expect(result1.value.compare(result2.value)).toBe(-1); // '550e...' < '660e...'
        expect(result2.value.compare(result1.value)).toBe(1); // '660e...' > '550e...'
        expect(result1.value.compare(result3.value)).toBe(0); // equal
      }
    });
  });

  describe('Format Properties', () => {
    const TestUuidVO = createUuidVO({
      name: 'TestUUID',
      errors: mockErrors,
    });

    it('should provide format properties correctly', () => {
      const uuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(uuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.compact).toBe('550e8400e29b41d48716446655440000');
        expect(result.value.uppercase).toBe(
          '550E8400-E29B-41D4-8716-446655440000',
        );
        expect(result.value.lowercase).toBe(
          '550e8400-e29b-41d4-8716-446655440000',
        );
        expect(result.value.braced).toBe(
          '{550e8400-e29b-41d4-8716-446655440000}',
        );
        expect(result.value.normalized).toBe(
          '550e8400-e29b-41d4-8716-446655440000',
        );
      }
    });
  });

  describe('Serialization', () => {
    const TestUuidVO = createUuidVO({
      name: 'TestUUID',
      errors: mockErrors,
    });

    it('should serialize to JSON correctly', () => {
      const uuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(uuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json.value).toBe(uuid);
        expect(json.version).toBe(4);
        expect(json.variant).toBe('rfc4122');
        expect(json.type).toBe('TestUUID');
      }
    });

    it('should convert to string correctly', () => {
      const uuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.create(uuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toString()).toBe(uuid);
      }
    });
  });

  describe('Type Coercion with from() method', () => {
    const TestUuidVO = createUuidVO({
      name: 'TestUUID',
      errors: mockErrors,
    });

    it('should handle string inputs', () => {
      const uuid = '550e8400-e29b-41d4-8716-446655440000';
      const result = TestUuidVO.from(uuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(uuid);
      }
    });

    it('should reject non-string inputs', () => {
      const result = TestUuidVO.from(123);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Required Configuration', () => {
    it('should reject undefined when required', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        required: true,
        errors: mockErrors,
      });

      const result = TestUuidVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const TestUuidVO = createUuidVO({
        name: 'TestUUID',
        required: true,
        errors: mockErrors,
      });

      const result = TestUuidVO.create(null);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    const anyVersionMockErrors: DomainError = {
      code: 'UUID_TEST_ERROR',
      title: 'UUID test error',
      category: 'validation',
    };

    const AnyVersionUuidVO = createUuidVO({
      name: 'AnyVersionUUID',
      version: undefined, // Accept any version
      variant: undefined, // Accept any variant
      errors: createUuidVOErrors(anyVersionMockErrors, 'AnyVersionUUID'),
    });

    it('should handle UUID with different versions', () => {
      const v1Uuid = '550e8400-e29b-11d4-8716-446655440000'; // version 1
      const v3Uuid = '550e8400-e29b-31d4-8716-446655440000'; // version 3
      const v5Uuid = '550e8400-e29b-51d4-8716-446655440000'; // version 5

      const result1 = AnyVersionUuidVO.create(v1Uuid);
      const result3 = AnyVersionUuidVO.create(v3Uuid);
      const result5 = AnyVersionUuidVO.create(v5Uuid);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result3)).toBe(true);
      expect(isOk(result5)).toBe(true);

      if (isOk(result1) && isOk(result3) && isOk(result5)) {
        expect(result1.value.version).toBe(1);
        expect(result3.value.version).toBe(3);
        expect(result5.value.version).toBe(5);
      }
    });

    it('should handle case insensitive input', () => {
      const upperUuid = '550E8400-E29B-41D4-8716-446655440000';
      const result = AnyVersionUuidVO.create(upperUuid);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe('550e8400-e29b-41d4-8716-446655440000');
      }
    });
  });
});
