import { createDateTimeVO, createDateTimeVOErrors } from '../datetime.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('DateTimeVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'DATETIME_TEST_ERROR',
    title: 'DateTime test error',
    category: 'validation',
  };

  const mockErrors = createDateTimeVOErrors(mockBaseError, 'TestDateTime');

  describe('Basic Creation', () => {
    const DateTimeVO = createDateTimeVO({
      name: 'TestDateTime',
      errors: mockErrors,
    });

    it('should create datetime VO with valid Date object', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const result = DateTimeVO.create(testDate);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toEqual(testDate);
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(0); // JavaScript Date months are 0-indexed
        expect(vo.day).toBe(15);
        expect(vo.hours).toBe(12); // UTC+2 timezone conversion
        expect(vo.minutes).toBe(30);
        expect(vo.seconds).toBe(0);
      }
    });

    it('should create datetime VO with valid ISO string', () => {
      const result = DateTimeVO.from('2024-01-15T10:30:00Z');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(0);
        expect(vo.day).toBe(15);
        expect(vo.hours).toBe(12); // UTC+2 timezone conversion
        expect(vo.minutes).toBe(30);
      }
    });

    it('should create datetime VO with valid date string', () => {
      const result = DateTimeVO.from('2024-01-15 10:30:00');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(0);
        expect(vo.day).toBe(15);
      }
    });

    it('should reject invalid datetime string', () => {
      const result = DateTimeVO.from('invalid-datetime');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DATETIME_TEST_ERROR');
      }
    });

    it('should reject null input by default', () => {
      const result = DateTimeVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = DateTimeVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });

    it('should create current datetime with now()', () => {
      const before = new Date();
      const result = DateTimeVO.now();
      const after = new Date();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(vo.value.getTime()).toBeLessThanOrEqual(after.getTime());
      }
    });
  });

  describe('DateTime Range Validation', () => {
    it('should accept datetimes within min/max range', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        minIso: '2024-01-01T00:00:00Z',
        maxIso: '2024-12-31T23:59:59Z',
        errors: mockErrors,
      });

      const result = DateTimeVO.from('2024-06-15T12:00:00Z');
      expect(isOk(result)).toBe(true);
    });

    it('should reject datetimes before minimum', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        minIso: '2024-01-01T00:00:00Z',
        errors: mockErrors,
      });

      const result = DateTimeVO.from('2023-12-31T23:59:59Z');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DATETIME_TEST_ERROR');
      }
    });

    it('should reject datetimes after maximum', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        maxIso: '2024-12-31T23:59:59Z',
        errors: mockErrors,
      });

      const result = DateTimeVO.from('2025-01-01T00:00:00Z');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Future/Past DateTime Restrictions', () => {
    it('should accept future datetimes when allowed', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        allowFuture: true,
        errors: mockErrors,
      });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const result = DateTimeVO.create(futureDate);
      expect(isOk(result)).toBe(true);
    });

    it('should reject future datetimes when not allowed', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        allowFuture: false,
        errors: mockErrors,
      });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const result = DateTimeVO.create(futureDate);
      expect(isErr(result)).toBe(true);
    });

    it('should accept past datetimes when allowed', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        allowPast: true,
        errors: mockErrors,
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const result = DateTimeVO.create(pastDate);
      expect(isOk(result)).toBe(true);
    });

    it('should reject past datetimes when not allowed', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        allowPast: false,
        errors: mockErrors,
      });

      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const result = DateTimeVO.create(pastDate);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Business Days Only', () => {
    it('should accept business days when required', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        businessDaysOnly: true,
        errors: mockErrors,
      });

      // Monday
      const result = DateTimeVO.from('2024-01-15T10:00:00Z'); // Monday
      expect(isOk(result)).toBe(true);
    });

    it('should reject weekends when business days required', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        businessDaysOnly: true,
        errors: mockErrors,
      });

      // Saturday
      const result = DateTimeVO.from('2024-01-13T10:00:00Z'); // Saturday
      expect(isErr(result)).toBe(true);
    });
  });

  describe('DateTime Properties', () => {
    const DateTimeVO = createDateTimeVO({
      name: 'TestDateTime',
      errors: mockErrors,
    });

    it('should provide correct datetime properties', () => {
      const result = DateTimeVO.from('2024-03-15T14:30:45Z'); // Friday

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(2); // March (0-indexed)
        expect(vo.day).toBe(15);
        expect(vo.hours).toBe(16); // UTC+2 timezone conversion
        expect(vo.minutes).toBe(30);
        expect(vo.seconds).toBe(45);
        expect(vo.dayOfWeek).toBe(5); // Friday
        expect(vo.isBusinessDay).toBe(true);
        expect(vo.isWeekend).toBe(false);
      }
    });

    it('should correctly identify today', () => {
      const now = new Date();
      const result = DateTimeVO.create(now);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.isToday).toBe(true);
      }
    });

    it('should correctly identify future/past', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const pastResult = DateTimeVO.create(pastDate);
      const futureResult = DateTimeVO.create(futureDate);

      expect(isOk(pastResult)).toBe(true);
      expect(isOk(futureResult)).toBe(true);

      if (isOk(pastResult) && isOk(futureResult)) {
        expect(pastResult.value.isPast).toBe(true);
        expect(pastResult.value.isFuture).toBe(false);
        expect(futureResult.value.isPast).toBe(false);
        expect(futureResult.value.isFuture).toBe(true);
      }
    });
  });

  describe('DateTime Operations', () => {
    const DateTimeVO = createDateTimeVO({
      name: 'TestDateTime',
      errors: mockErrors,
    });

    it('should add days correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:00:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newResult = result.value.addDays(5);
        expect(isOk(newResult)).toBe(true);

        if (isOk(newResult)) {
          expect(newResult.value.day).toBe(20);
          expect(newResult.value.month).toBe(0); // January
          expect(newResult.value.year).toBe(2024);
        }
      }
    });

    it('should add hours correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:00:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newResult = result.value.addHours(3);
        expect(isOk(newResult)).toBe(true);

        if (isOk(newResult)) {
          expect(newResult.value.hours).toBe(15); // 12 (local) + 3 hours
        }
      }
    });

    it('should add months correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:00:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newResult = result.value.addMonths(2);
        expect(isOk(newResult)).toBe(true);

        if (isOk(newResult)) {
          expect(newResult.value.month).toBe(2); // March
        }
      }
    });

    it('should handle start/end of day correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:30:45Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const startOfDay = result.value.startOfDay();
        const endOfDay = result.value.endOfDay();

        expect(isOk(startOfDay)).toBe(true);
        expect(isOk(endOfDay)).toBe(true);

        if (isOk(startOfDay) && isOk(endOfDay)) {
          expect(startOfDay.value.hours).toBe(0);
          expect(startOfDay.value.minutes).toBe(0);
          expect(startOfDay.value.seconds).toBe(0);
          expect(startOfDay.value.milliseconds).toBe(0);

          expect(endOfDay.value.hours).toBe(23);
          expect(endOfDay.value.minutes).toBe(59);
          expect(endOfDay.value.seconds).toBe(59);
          expect(endOfDay.value.milliseconds).toBe(999);
        }
      }
    });
  });

  describe('DateTime Comparison', () => {
    const DateTimeVO = createDateTimeVO({
      name: 'TestDateTime',
      errors: mockErrors,
    });

    it('should compare datetimes correctly', () => {
      const earlyResult = DateTimeVO.from('2024-01-15T10:00:00Z');
      const lateResult = DateTimeVO.from('2024-01-15T11:00:00Z');

      expect(isOk(earlyResult)).toBe(true);
      expect(isOk(lateResult)).toBe(true);

      if (isOk(earlyResult) && isOk(lateResult)) {
        const early = earlyResult.value;
        const late = lateResult.value;

        expect(early.isBefore(late)).toBe(true);
        expect(late.isAfter(early)).toBe(true);
        expect(early.compare(late)).toBe(-1);
        expect(late.compare(early)).toBe(1);
        expect(early.compare(early)).toBe(0);
      }
    });

    it('should calculate time differences correctly', () => {
      const startResult = DateTimeVO.from('2024-01-15T10:00:00Z');
      const endResult = DateTimeVO.from('2024-01-15T11:30:00Z');

      expect(isOk(startResult)).toBe(true);
      expect(isOk(endResult)).toBe(true);

      if (isOk(startResult) && isOk(endResult)) {
        const start = startResult.value;
        const end = endResult.value;

        expect(start.differenceInHours(end)).toBe(2);
        expect(start.differenceInMinutes(end)).toBe(90);
        expect(start.differenceInSeconds(end)).toBe(5400);
        expect(start.differenceInMilliseconds(end)).toBe(5400000);
      }
    });
  });

  describe('Serialization', () => {
    const DateTimeVO = createDateTimeVO({
      name: 'TestDateTime',
      errors: mockErrors,
    });

    it('should serialize to JSON correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:30:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json.type).toBe('TestDateTime');
        expect(json.value).toMatch(/^2024-01-15T10:30:00/);
      }
    });

    it('should convert to string formats correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:30:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.toISOString()).toMatch(/^2024-01-15T10:30:00/);
        expect(result.value.toDateString()).toBe('2024-01-15');
        expect(result.value.toTimeString()).toMatch(/12:30:00/); // Local time UTC+2
      }
    });

    it('should convert to string correctly', () => {
      const result = DateTimeVO.from('2024-01-15T10:30:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const str = result.value.toString();
        expect(typeof str).toBe('string');
        expect(str.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Normalization', () => {
    it('should normalize to start of day', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        normalizeTo: 'startOfDay',
        errors: mockErrors,
      });

      const result = DateTimeVO.from('2024-01-15T10:30:45Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.hours).toBe(0);
        expect(result.value.minutes).toBe(0);
        expect(result.value.seconds).toBe(0);
        expect(result.value.milliseconds).toBe(0);
      }
    });

    it('should normalize to UTC', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        normalizeTo: 'utc',
        errors: mockErrors,
      });

      // Create a date with timezone offset
      const localDate = new Date('2024-01-15T10:30:00');
      const result = DateTimeVO.create(localDate);
      expect(isOk(result)).toBe(true);

      // The result should be adjusted for timezone offset
      if (isOk(result)) {
        const offsetMs = localDate.getTimezoneOffset() * 60 * 1000;
        const expectedTime = localDate.getTime() + offsetMs;
        expect(result.value.value.getTime()).toBe(expectedTime);
      }
    });

    it('should convert to string representation', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        errors: mockErrors,
      });

      const result = DateTimeVO.from('2024-01-15T10:30:00Z');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const str = result.value.toString();
        expect(typeof str).toBe('string');
        expect(str.length).toBeGreaterThan(0);
      }
    });

    it('should calculate difference in days with Math.ceil edge cases', () => {
      const DateTimeVO = createDateTimeVO({
        name: 'TestDateTime',
        errors: mockErrors,
      });

      const date1Result = DateTimeVO.from('2024-01-15T10:00:00Z');
      const date2Result = DateTimeVO.from('2024-01-16T09:59:59Z'); // Less than 24 hours but should ceil to 1 day

      expect(isOk(date1Result)).toBe(true);
      expect(isOk(date2Result)).toBe(true);

      if (isOk(date1Result) && isOk(date2Result)) {
        const diff = date1Result.value.differenceInDays(date2Result.value);
        expect(diff).toBe(1); // Should be 1 due to Math.ceil
      }
    });
  });
});
