import { createDurationVO, createDurationVOErrors } from '../duration.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('DurationVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'DURATION_TEST_ERROR',
    title: 'Duration test error',
    category: 'validation',
  };

  const mockErrors = createDurationVOErrors(mockBaseError, 'TestDuration');

  describe('Basic Creation', () => {
    const DurationVO = createDurationVO({
      name: 'TestDuration',
      errors: mockErrors,
    });

    it('should create duration VO with milliseconds number', () => {
      const result = DurationVO.create(5000);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.toMilliseconds()).toBe(5000);
        expect(vo.toSeconds()).toBe(5);
        expect(vo.toMinutes()).toBe(5 / 60);
        expect(vo.toHours()).toBe(5 / 3600);
      }
    });

    it('should create duration VO with string formats', () => {
      const testCases = [
        { input: '5000', expected: 5000 },
        { input: '5s', expected: 5000 },
        { input: '2m', expected: 120000 },
        { input: '1h', expected: 3600000 },
        { input: '3d', expected: 259200000 },
      ];

      for (const { input, expected } of testCases) {
        const result = DurationVO.create(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.toMilliseconds()).toBe(expected);
        }
      }
    });

    it('should create duration VO with ISO 8601 format', () => {
      const DurationVOWithIso = createDurationVO({
        name: 'TestDuration',
        allowIso8601: true,
        errors: mockErrors,
      });

      const result = DurationVOWithIso.create('PT1H30M5S');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toMilliseconds()).toBe(5405000); // 1h + 30m + 5s
      }
    });

    it('should create duration VO with clock format', () => {
      const DurationVOWithClock = createDurationVO({
        name: 'TestDuration',
        allowClock: true,
        errors: mockErrors,
      });

      const result = DurationVOWithClock.create('01:30:05');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toMilliseconds()).toBe(5405000); // 1h + 30m + 5s
      }
    });

    it('should reject invalid duration string', () => {
      const result = DurationVO.create('invalid-duration');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DURATION_TEST_ERROR');
      }
    });

    it('should reject null input by default', () => {
      const result = DurationVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = DurationVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Duration Range Validation', () => {
    it('should accept durations within min/max range', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        minMs: 1000,
        maxMs: 3600000, // 1 hour
        errors: mockErrors,
      });

      const result = DurationVO.create('30m'); // 30 minutes = 1,800,000 ms
      expect(isOk(result)).toBe(true);
    });

    it('should reject durations below minimum', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        minMs: 60000, // 1 minute
        errors: mockErrors,
      });

      const result = DurationVO.create('30s'); // 30 seconds
      expect(isErr(result)).toBe(true);
    });

    it('should reject durations above maximum', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        maxMs: 3600000, // 1 hour
        errors: mockErrors,
      });

      const result = DurationVO.create('2h'); // 2 hours
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Non-negative Durations', () => {
    it('should accept non-negative durations when required', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        nonNegative: true,
        errors: mockErrors,
      });

      const result = DurationVO.create('30m');
      expect(isOk(result)).toBe(true);
    });

    it('should reject negative durations when non-negative required', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        nonNegative: true,
        errors: mockErrors,
      });

      const result = DurationVO.create('-30m');
      expect(isErr(result)).toBe(true);
    });

    it('should accept negative durations when allowed', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        nonNegative: false,
        errors: mockErrors,
      });

      const result = DurationVO.create('-30m');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toMilliseconds()).toBe(-1800000);
      }
    });
  });

  describe('Duration Operations', () => {
    const DurationVO = createDurationVO({
      name: 'TestDuration',
      errors: mockErrors,
    });

    it('should add durations correctly', () => {
      const duration1 = DurationVO.create('30m');
      const duration2 = DurationVO.create('45m');

      expect(isOk(duration1)).toBe(true);
      expect(isOk(duration2)).toBe(true);

      if (isOk(duration1) && isOk(duration2)) {
        const result = duration1.value.add(duration2.value);
        expect(result.toMilliseconds()).toBe(4500000); // 75 minutes
      }
    });

    it('should subtract durations correctly', () => {
      const duration1 = DurationVO.create('60m');
      const duration2 = DurationVO.create('30m');

      expect(isOk(duration1)).toBe(true);
      expect(isOk(duration2)).toBe(true);

      if (isOk(duration1) && isOk(duration2)) {
        const result = duration1.value.subtract(duration2.value);
        expect(result.toMilliseconds()).toBe(1800000); // 30 minutes
      }
    });

    it('should multiply durations correctly', () => {
      const duration = DurationVO.create('30m');

      expect(isOk(duration)).toBe(true);

      if (isOk(duration)) {
        const result = duration.value.multiply(2);
        expect(result.toMilliseconds()).toBe(3600000); // 60 minutes
      }
    });

    it('should divide durations correctly', () => {
      const duration = DurationVO.create('60m');

      expect(isOk(duration)).toBe(true);

      if (isOk(duration)) {
        const result = duration.value.divide(2);
        expect(result.toMilliseconds()).toBe(1800000); // 30 minutes
      }
    });

    it('should throw error for negative multiplication factor', () => {
      const duration = DurationVO.create('30m');

      expect(isOk(duration)).toBe(true);

      if (isOk(duration)) {
        expect(() => duration.value.multiply(-1)).toThrow(
          'Factor cannot be negative',
        );
      }
    });

    it('should throw error for zero division factor', () => {
      const duration = DurationVO.create('30m');

      expect(isOk(duration)).toBe(true);

      if (isOk(duration)) {
        expect(() => duration.value.divide(0)).toThrow(
          'Factor must be positive',
        );
      }
    });

    it('should throw error for negative subtraction result', () => {
      const duration1 = DurationVO.create('30m');
      const duration2 = DurationVO.create('60m');

      expect(isOk(duration1)).toBe(true);
      expect(isOk(duration2)).toBe(true);

      if (isOk(duration1) && isOk(duration2)) {
        expect(() => duration1.value.subtract(duration2.value)).toThrow(
          'Duration cannot be negative after subtraction',
        );
      }
    });
  });

  describe('Duration Comparisons', () => {
    const DurationVO = createDurationVO({
      name: 'TestDuration',
      errors: mockErrors,
    });

    it('should compare durations correctly', () => {
      const shortDuration = DurationVO.create('30m');
      const longDuration = DurationVO.create('60m');

      expect(isOk(shortDuration)).toBe(true);
      expect(isOk(longDuration)).toBe(true);

      if (isOk(shortDuration) && isOk(longDuration)) {
        const short = shortDuration.value;
        const long = longDuration.value;

        expect(short.isShorterThan(long)).toBe(true);
        expect(long.isLongerThan(short)).toBe(true);
        expect(short.equals(short)).toBe(true);
        expect(short.equals(long)).toBe(false);
        expect(short.compare(long)).toBe(-1);
        expect(long.compare(short)).toBe(1);
        expect(short.compare(short)).toBe(0);
      }
    });
  });

  describe('Duration Conversion', () => {
    const DurationVO = createDurationVO({
      name: 'TestDuration',
      errors: mockErrors,
    });

    it('should convert to various time units correctly', () => {
      const duration = DurationVO.create(3661000); // 1h 1m 1s 1000ms

      expect(isOk(duration)).toBe(true);

      if (isOk(duration)) {
        const vo = duration.value;
        expect(vo.toMilliseconds()).toBe(3661000);
        expect(vo.toSeconds()).toBe(3661);
        expect(vo.toMinutes()).toBe(61.016666666666666);
        expect(vo.toHours()).toBe(1.0169444444444444);
        expect(vo.toDays()).toBe(0.04237268518518519);
      }
    });

    it('should provide human readable format', () => {
      const testCases = [
        { input: 500, expected: '500ms' },
        { input: 5000, expected: '5.0s' },
        { input: 120000, expected: '2.0m' },
        { input: 3600000, expected: '1.0h' },
        { input: 86400000, expected: '1.0d' },
      ];

      for (const { input, expected } of testCases) {
        const result = DurationVO.create(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.toHumanReadable()).toBe(expected);
        }
      }
    });
  });

  describe('Serialization', () => {
    const DurationVO = createDurationVO({
      name: 'TestDuration',
      errors: mockErrors,
    });

    it('should serialize to JSON correctly', () => {
      const result = DurationVO.create('30m');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json.type).toBe('duration');
        expect(json.value).toBe(1800000);
        expect(json.unit).toBe('ms');
      }
    });

    it('should convert to string correctly', () => {
      const result = DurationVO.create('30m');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.toString()).toBe('30.0m');
      }
    });
  });

  describe('Normalization', () => {
    it('should normalize to seconds', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        normalizeTo: 'seconds',
        errors: mockErrors,
      });

      const result = DurationVO.create(1234); // 1234ms
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.toMilliseconds()).toBe(1000); // Rounded to nearest second
      }
    });

    it('should normalize to minutes', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        normalizeTo: 'minutes',
        errors: mockErrors,
      });

      const result = DurationVO.create(90000); // 1.5 minutes
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.toMilliseconds()).toBe(120000); // Keeps original value when normalizing
      }
    });
  });

  describe('Unit Restrictions', () => {
    it('should reject disallowed units', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        allowMillisUnit: false,
        errors: mockErrors,
      });

      const result = DurationVO.create('5000ms');
      expect(isErr(result)).toBe(true);
    });

    it('should accept allowed units', () => {
      const DurationVO = createDurationVO({
        name: 'TestDuration',
        allowSeconds: true,
        allowMinutes: false,
        errors: mockErrors,
      });

      const validResult = DurationVO.create('30s');
      const invalidResult = DurationVO.create('30m');

      expect(isOk(validResult)).toBe(true);
      expect(isErr(invalidResult)).toBe(true);
    });
  });

  describe('Additional Features', () => {
    const DurationVO = createDurationVO({
      name: 'TestDuration',
      errors: mockErrors,
    });

    it('should create from existing DurationVO using from method', () => {
      const original = DurationVO.create('30m');
      expect(isOk(original)).toBe(true);

      if (isOk(original)) {
        const result = DurationVO.from(original.value);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.toMilliseconds()).toBe(1800000);
          expect(result.value).toBe(original.value); // Should return the same instance
        }
      }
    });

    it('should validate using schema correctly', () => {
      const schema = DurationVO.schema;

      // Valid inputs
      expect(schema.safeParse('30m').success).toBe(true);
      expect(schema.safeParse(1800000).success).toBe(true);
      expect(schema.safeParse('5s').success).toBe(true);

      // Invalid inputs
      expect(schema.safeParse('invalid').success).toBe(false);
      expect(schema.safeParse(-1000).success).toBe(true); // Negative allowed when nonNegative is not set
    });

    it('should validate schema with custom constraints', () => {
      const ConstrainedDurationVO = createDurationVO({
        name: 'ConstrainedDuration',
        nonNegative: true,
        minMs: 1000,
        maxMs: 3600000,
        errors: mockErrors,
      });

      const schema = ConstrainedDurationVO.schema;

      // Valid within constraints
      expect(schema.safeParse('30s').success).toBe(true); // 30000ms > 1000ms
      expect(schema.safeParse(1800000).success).toBe(true); // Within range

      // Invalid - below minimum
      expect(schema.safeParse('500ms').success).toBe(false); // 500ms < 1000ms

      // Invalid - above maximum
      expect(schema.safeParse('2h').success).toBe(false); // 7200000ms > 3600000ms

      // Invalid - negative
      expect(schema.safeParse('-30s').success).toBe(false);
    });
  });
});
