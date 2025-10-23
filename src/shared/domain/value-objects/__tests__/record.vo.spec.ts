import { createRecordVO, createRecordVOErrors } from '../record.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('RecordVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'RECORD_TEST_ERROR',
    title: 'Record test error',
    category: 'validation',
  };

  const mockErrors = createRecordVOErrors(mockBaseError, 'TestRecord');

  describe('Basic Creation', () => {
    const RecordVO = createRecordVO({
      name: 'TestRecord',
      allowEmpty: true,
      errors: mockErrors,
    });

    it('should create record VO with valid object', () => {
      const testRecord = { name: 'John', age: 30 };
      const result = RecordVO.create(testRecord);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toEqual(testRecord);
        expect(vo.size).toBe(2);
        expect(vo.isEmpty).toBe(false);
        expect(vo.keys).toEqual(['name', 'age']);
        expect(vo.values).toEqual(['John', 30]);
      }
    });

    it('should create empty record when allowed', () => {
      const result = RecordVO.create({});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isEmpty).toBe(true);
        expect(result.value.size).toBe(0);
      }
    });

    it('should handle null/undefined input for optional records', () => {
      const OptionalRecordVO = createRecordVO({
        name: 'OptionalRecord',
        allowEmpty: true,
        required: false,
        errors: mockErrors,
      });

      expect(isErr(OptionalRecordVO.create(null))).toBe(true);
      expect(isErr(OptionalRecordVO.create(undefined))).toBe(true);
    });

    it('should reject non-object inputs', () => {
      expect(isErr(RecordVO.from('string'))).toBe(true);
      expect(isErr(RecordVO.from(123))).toBe(true);
      expect(isErr(RecordVO.from([]))).toBe(true);
      expect(isErr(RecordVO.from(true))).toBe(true);
    });

    it('should create record from unknown value using from()', () => {
      const testRecord = { key: 'value' };
      const result = RecordVO.from(testRecord);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toEqual(testRecord);
      }
    });

    it('should reject invalid types in from()', () => {
      expect(isErr(RecordVO.from('string'))).toBe(true);
      expect(isErr(RecordVO.from(123))).toBe(true);
      expect(isErr(RecordVO.from([]))).toBe(true);
    });
  });

  describe('Validation Rules', () => {
    it('should reject empty records when not allowed', () => {
      const NonEmptyRecordVO = createRecordVO({
        name: 'NonEmptyRecord',
        allowEmpty: false,
        errors: mockErrors,
      });

      const result = NonEmptyRecordVO.create({});
      expect(isErr(result)).toBe(true);
    });

    it('should enforce minimum key count', () => {
      const MinKeysRecordVO = createRecordVO({
        name: 'MinKeysRecord',
        allowEmpty: true,
        minKeys: 2,
        errors: mockErrors,
      });

      expect(isErr(MinKeysRecordVO.create({}))).toBe(true);
      expect(isErr(MinKeysRecordVO.create({ key1: 'value1' }))).toBe(true);
      expect(
        isOk(MinKeysRecordVO.create({ key1: 'value1', key2: 'value2' })),
      ).toBe(true);
    });

    it('should enforce maximum key count', () => {
      const MaxKeysRecordVO = createRecordVO({
        name: 'MaxKeysRecord',
        allowEmpty: true,
        maxKeys: 2,
        errors: mockErrors,
      });

      expect(
        isOk(MaxKeysRecordVO.create({ key1: 'value1', key2: 'value2' })),
      ).toBe(true);
      expect(
        isErr(
          MaxKeysRecordVO.create({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
          }),
        ),
      ).toBe(true);
    });

    it('should validate key patterns', () => {
      const PatternRecordVO = createRecordVO({
        name: 'PatternRecord',
        allowEmpty: true,
        keyPattern: /^[a-z]+$/,
        errors: mockErrors,
      });

      expect(isOk(PatternRecordVO.create({ validkey: 'value' }))).toBe(true);
      expect(isErr(PatternRecordVO.create({ invalid_key: 'value' }))).toBe(
        true,
      );
      expect(isErr(PatternRecordVO.create({ '123invalid': 'value' }))).toBe(
        true,
      );
    });

    it('should enforce required keys', () => {
      const RequiredKeysRecordVO = createRecordVO({
        name: 'RequiredKeysRecord',
        allowEmpty: true,
        requiredKeys: ['id', 'name'],
        errors: mockErrors,
      });

      expect(isErr(RequiredKeysRecordVO.create({}))).toBe(true);
      expect(isErr(RequiredKeysRecordVO.create({ id: '123' }))).toBe(true);
      expect(isErr(RequiredKeysRecordVO.create({ name: 'John' }))).toBe(true);
      expect(
        isOk(RequiredKeysRecordVO.create({ id: '123', name: 'John' })),
      ).toBe(true);
    });

    it('should reject forbidden keys', () => {
      const ForbiddenKeysRecordVO = createRecordVO({
        name: 'ForbiddenKeysRecord',
        allowEmpty: true,
        forbiddenKeys: ['password', 'secret'],
        errors: mockErrors,
      });

      expect(isOk(ForbiddenKeysRecordVO.create({ username: 'john' }))).toBe(
        true,
      );
      expect(
        isErr(
          ForbiddenKeysRecordVO.create({
            username: 'john',
            password: 'secret',
          }),
        ),
      ).toBe(true);
      expect(isErr(ForbiddenKeysRecordVO.create({ secret: 'data' }))).toBe(
        true,
      );
    });
  });

  describe('Key Case Transformation', () => {
    it('should transform keys to lowercase', () => {
      const LowerCaseRecordVO = createRecordVO({
        name: 'LowerCaseRecord',
        allowEmpty: true,
        keyCase: 'lower',
        errors: mockErrors,
      });

      const result = LowerCaseRecordVO.create({
        FirstName: 'John',
        LastName: 'Doe',
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.keys).toEqual(['firstname', 'lastname']);
        expect(result.value.get('firstname')).toBe('John');
        expect(result.value.get('lastname')).toBe('Doe');
      }
    });

    it('should transform keys to uppercase', () => {
      const UpperCaseRecordVO = createRecordVO({
        name: 'UpperCaseRecord',
        allowEmpty: true,
        keyCase: 'upper',
        errors: mockErrors,
      });

      const result = UpperCaseRecordVO.create({
        firstname: 'John',
        lastname: 'Doe',
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.keys).toEqual(['FIRSTNAME', 'LASTNAME']);
      }
    });

    it('should transform keys to camelCase', () => {
      const CamelCaseRecordVO = createRecordVO({
        name: 'CamelCaseRecord',
        allowEmpty: true,
        keyCase: 'camel',
        errors: mockErrors,
      });

      const result = CamelCaseRecordVO.create({
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.keys).toEqual(['firstName', 'lastName']);
      }
    });

    it('should transform keys to snake_case', () => {
      const SnakeCaseRecordVO = createRecordVO({
        name: 'SnakeCaseRecord',
        allowEmpty: true,
        keyCase: 'snake',
        errors: mockErrors,
      });

      const result = SnakeCaseRecordVO.create({
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.keys).toEqual(['first_name', 'last_name']);
      }
    });

    it('should transform keys to kebab-case', () => {
      const KebabCaseRecordVO = createRecordVO({
        name: 'KebabCaseRecord',
        allowEmpty: true,
        keyCase: 'kebab',
        errors: mockErrors,
      });

      const result = KebabCaseRecordVO.create({
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.keys).toEqual(['first-name', 'last-name']);
      }
    });
  });

  describe('Record Operations', () => {
    const RecordVO = createRecordVO({
      name: 'TestRecord',
      allowEmpty: true,
      errors: mockErrors,
    });

    let testRecord: any;

    beforeEach(() => {
      const result = RecordVO.create({ name: 'John', age: 30, city: 'NYC' });
      if (isOk(result)) {
        testRecord = result.value;
      }
    });

    it('should check if key exists with has()', () => {
      expect(testRecord.has('name')).toBe(true);
      expect(testRecord.has('age')).toBe(true);
      expect(testRecord.has('nonexistent')).toBe(false);
    });

    it('should get values with get()', () => {
      expect(testRecord.get('name')).toBe('John');
      expect(testRecord.get('age')).toBe(30);
      expect(testRecord.get('nonexistent')).toBeUndefined();
    });

    it('should merge records', () => {
      const otherRecord = RecordVO.create({ age: 35, country: 'USA' });
      if (isOk(otherRecord)) {
        const merged = testRecord.merge(otherRecord.value);
        expect(isOk(merged)).toBe(true);
        if (isOk(merged)) {
          expect((merged as any).value.get('name')).toBe('John'); // original

          expect((merged as any).value.get('age')).toBe(35); // overridden

          expect((merged as any).value.get('city')).toBe('NYC'); // original

          expect((merged as any).value.get('country')).toBe('USA'); // added
        }
      }
    });

    it('should pick specific keys', () => {
      const picked = testRecord.pick(['name', 'age']);
      expect(isOk(picked)).toBe(true);
      if (isOk(picked)) {
        expect((picked as any).value.size).toBe(2);

        expect((picked as any).value.has('name')).toBe(true);

        expect((picked as any).value.has('age')).toBe(true);

        expect((picked as any).value.has('city')).toBe(false);
      }
    });

    it('should omit specific keys', () => {
      const omitted = testRecord.omit(['age']);
      expect(isOk(omitted)).toBe(true);
      if (isOk(omitted)) {
        expect((omitted as any).value.size).toBe(2);

        expect((omitted as any).value.has('name')).toBe(true);

        expect((omitted as any).value.has('city')).toBe(true);

        expect((omitted as any).value.has('age')).toBe(false);
      }
    });

    it('should set key-value pairs', () => {
      const updated = testRecord.set('age', 35);
      expect(isOk(updated)).toBe(true);
      if (isOk(updated)) {
        expect((updated as any).value.get('age')).toBe(35);

        expect((updated as any).value.get('name')).toBe('John'); // unchanged
      }
    });

    it('should delete keys', () => {
      const deleted = testRecord.delete('age');
      expect(isOk(deleted)).toBe(true);
      if (isOk(deleted)) {
        expect((deleted as any).value.size).toBe(2);

        expect((deleted as any).value.has('age')).toBe(false);

        expect((deleted as any).value.has('name')).toBe(true);
      }
    });
  });

  describe('Comparison Operations', () => {
    const RecordVO = createRecordVO({
      name: 'TestRecord',
      allowEmpty: true,
      errors: mockErrors,
    });

    it('should compare equal records', () => {
      const record1 = RecordVO.create({ a: 1, b: 2 });
      const record2 = RecordVO.create({ a: 1, b: 2 });
      const record3 = RecordVO.create({ b: 2, a: 1 }); // same content, different order

      if (isOk(record1) && isOk(record2) && isOk(record3)) {
        expect(record1.value.equals(record2.value)).toBe(true);
        expect(record1.value.equals(record3.value)).toBe(true);
      }
    });

    it('should compare unequal records', () => {
      const record1 = RecordVO.create({ a: 1, b: 2 });
      const record2 = RecordVO.create({ a: 1, b: 3 });
      const record3 = RecordVO.create({ a: 1 });
      const record4 = RecordVO.create({ a: 1, b: 2, c: 3 });

      if (isOk(record1) && isOk(record2) && isOk(record3) && isOk(record4)) {
        expect(record1.value.equals(record2.value)).toBe(false);
        expect(record1.value.equals(record3.value)).toBe(false);
        expect(record1.value.equals(record4.value)).toBe(false);
      }
    });

    it('should compare records lexicographically', () => {
      const record1 = RecordVO.create({ a: 1 });
      const record2 = RecordVO.create({ b: 1 });
      const record3 = RecordVO.create({ a: 2 });

      if (isOk(record1) && isOk(record2) && isOk(record3)) {
        expect(record1.value.compare(record2.value)).toBe(-1); // 'a' < 'b'
        expect(record2.value.compare(record1.value)).toBe(1); // 'b' > 'a'
        expect(record1.value.compare(record3.value)).toBe(-1); // same key, 1 < 2
        expect(record1.value.compare(record1.value)).toBe(0); // equal
      }
    });
  });

  describe('Serialization', () => {
    const RecordVO = createRecordVO({
      name: 'TestRecord',
      allowEmpty: true,
      errors: mockErrors,
    });

    it('should serialize to string', () => {
      const record = RecordVO.create({ name: 'John', age: 30 });
      if (isOk(record)) {
        const str = record.value.toString();
        expect(typeof str).toBe('string');
        expect(str).toContain('John');
        expect(str).toContain('30');
      }
    });

    it('should serialize to JSON', () => {
      const record = RecordVO.create({ name: 'John', age: 30 });
      if (isOk(record)) {
        const json = record.value.toJSON();
        expect(json).toEqual({
          value: { name: 'John', age: 30 },
          type: 'TestRecord',
        });
      }
    });
  });

  describe('Refinements and Custom Validation', () => {
    it('should apply refinement rules', () => {
      const RefinedRecordVO = createRecordVO({
        name: 'RefinedRecord',
        allowEmpty: true,
        refinements: [
          {
            name: 'age-validation',
            test: (value) => {
              const age = value.age as number;
              return typeof age === 'number' && age >= 0 && age <= 150;
            },
            createError: (value) => ({
              ...mockBaseError,
              detail: 'Age must be between 0 and 150',
              context: { value },
            }),
          },
        ],
        errors: mockErrors,
      });

      expect(isOk(RefinedRecordVO.create({ name: 'John', age: 30 }))).toBe(
        true,
      );
      expect(isErr(RefinedRecordVO.create({ name: 'John', age: 200 }))).toBe(
        true,
      );
      expect(isErr(RefinedRecordVO.create({ name: 'John', age: -5 }))).toBe(
        true,
      );
    });

    it('should apply custom validation', () => {
      const CustomRecordVO = createRecordVO({
        name: 'CustomRecord',
        allowEmpty: true,
        customValidation: (value) => {
          const email = value.email as string;
          if (email && !email.includes('@')) {
            return {
              ok: false,
              error: {
                ...mockBaseError,
                detail: 'Invalid email format',
                context: { value },
              },
            };
          }
          return { ok: true, value };
        },
        errors: mockErrors,
      });

      expect(
        isOk(
          CustomRecordVO.create({ name: 'John', email: 'john@example.com' }),
        ),
      ).toBe(true);
      expect(
        isErr(CustomRecordVO.create({ name: 'John', email: 'invalid-email' })),
      ).toBe(true);
    });
  });

  describe('Required Records', () => {
    const RequiredRecordVO = createRecordVO({
      name: 'RequiredRecord',
      allowEmpty: true,
      required: true,
      errors: {
        ...mockErrors,
        required: () => ({
          ...mockBaseError,
          detail: 'RequiredRecord is required',
        }),
      },
    });

    it('should reject null/undefined for required records', () => {
      expect(isErr(RequiredRecordVO.create(null))).toBe(true);
      expect(isErr(RequiredRecordVO.create(undefined))).toBe(true);
    });

    it('should accept valid records for required records', () => {
      expect(isOk(RequiredRecordVO.create({ key: 'value' }))).toBe(true);
    });
  });
});
