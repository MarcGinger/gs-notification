import { createDateVO, createDateVOErrors } from '../date.vo';
import { DomainError, isOk, isErr } from '../../../errors';

describe('DateVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'DATE_TEST_ERROR',
    title: 'Date test error',
    category: 'validation',
  };

  const mockErrors = createDateVOErrors(mockBaseError, 'TestDate');

  describe('Basic Creation', () => {
    const DateVO = createDateVO({
      name: 'TestDate',
      errors: mockErrors,
    });

    it('should create date VO with valid Date object', () => {
      const testDate = new Date('2024-01-15');
      const result = DateVO.create(testDate);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.value).toEqual(testDate);
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(0); // JavaScript Date months are 0-indexed
        expect(vo.day).toBe(15);
        expect(vo.dayOfWeek).toBe(1); // Monday
      }
    });

    it('should create date VO with valid ISO string', () => {
      const result = DateVO.from('2024-01-15');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(0); // JavaScript Date months are 0-indexed
        expect(vo.day).toBe(15);
      }
    });

    it('should reject invalid date string', () => {
      const result = DateVO.from('invalid-date');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DATE_TEST_ERROR');
      }
    });

    it('should reject null input by default', () => {
      const result = DateVO.create(null);

      expect(isErr(result)).toBe(true);
    });

    it('should reject undefined input by default', () => {
      const result = DateVO.create(undefined);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('Date Range Validation', () => {
    it('should accept dates within min/max range', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        minIso: '2024-01-01',
        maxIso: '2024-12-31',
        errors: mockErrors,
      });

      const result = DateVO.from('2024-06-15');
      expect(isOk(result)).toBe(true);
    });

    it('should reject dates before minimum', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        minIso: '2024-01-01',
        errors: mockErrors,
      });

      const result = DateVO.from('2023-12-31');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DATE_TEST_ERROR');
      }
    });

    it('should reject dates after maximum', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        maxIso: '2024-12-31',
        errors: mockErrors,
      });

      const result = DateVO.from('2025-01-01');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Future/Past Date Restrictions', () => {
    it('should accept future dates when allowed', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        allowFuture: true,
        errors: mockErrors,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = DateVO.create(futureDate);
      expect(isOk(result)).toBe(true);
    });

    it('should reject future dates when not allowed', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        allowFuture: false,
        errors: mockErrors,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = DateVO.create(futureDate);
      expect(isErr(result)).toBe(true);
    });

    it('should accept past dates when allowed', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        allowPast: true,
        errors: mockErrors,
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const result = DateVO.create(pastDate);
      expect(isOk(result)).toBe(true);
    });

    it('should reject past dates when not allowed', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        allowPast: false,
        errors: mockErrors,
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const result = DateVO.create(pastDate);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Business Days Only', () => {
    it('should accept business days when required', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        businessDaysOnly: true,
        errors: mockErrors,
      });

      // Monday (business day)
      const result = DateVO.from('2024-01-15'); // Monday
      expect(isOk(result)).toBe(true);
    });

    it('should reject weekends when business days required', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        businessDaysOnly: true,
        errors: mockErrors,
      });

      // Saturday
      const result = DateVO.from('2024-01-13'); // Saturday
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Date Properties', () => {
    const DateVO = createDateVO({
      name: 'TestDate',
      errors: mockErrors,
    });

    it('should provide correct date properties', () => {
      const result = DateVO.from('2024-03-15'); // Friday

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const vo = result.value;
        expect(vo.year).toBe(2024);
        expect(vo.month).toBe(2); // March is month 2 (0-indexed)
        expect(vo.day).toBe(15);
        expect(vo.dayOfWeek).toBe(5); // Friday
        expect(vo.isBusinessDay).toBe(true);
        expect(vo.isWeekend).toBe(false);
      }
    });

    it('should correctly identify today', () => {
      const today = new Date();
      const result = DateVO.create(today);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isToday).toBe(true);
      }
    });

    it('should correctly identify future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = DateVO.create(futureDate);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isFuture).toBe(true);
        expect(result.value.isPast).toBe(false);
      }
    });

    it('should correctly identify past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const result = DateVO.create(pastDate);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isPast).toBe(true);
        expect(result.value.isFuture).toBe(false);
      }
    });
  });

  describe('Date Operations', () => {
    const DateVO = createDateVO({
      name: 'TestDate',
      errors: mockErrors,
    });

    it('should add days correctly', () => {
      const result = DateVO.from('2024-01-15');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newDateResult = result.value.addDays(5);
        expect(isOk(newDateResult)).toBe(true);

        if (isOk(newDateResult)) {
          expect(newDateResult.value.year).toBe(2024);
          expect(newDateResult.value.month).toBe(0); // January is month 0
          expect(newDateResult.value.day).toBe(20);
        }
      }
    });

    it('should add months correctly', () => {
      const result = DateVO.from('2024-01-15');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newDateResult = result.value.addMonths(2);
        expect(isOk(newDateResult)).toBe(true);

        if (isOk(newDateResult)) {
          expect(newDateResult.value.year).toBe(2024);
          expect(newDateResult.value.month).toBe(2); // March is month 2
          expect(newDateResult.value.day).toBe(15);
        }
      }
    });

    it('should add years correctly', () => {
      const result = DateVO.from('2024-01-15');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const newDateResult = result.value.addYears(1);
        expect(isOk(newDateResult)).toBe(true);

        if (isOk(newDateResult)) {
          expect(newDateResult.value.year).toBe(2025);
          expect(newDateResult.value.month).toBe(0); // January is month 0
          expect(newDateResult.value.day).toBe(15);
        }
      }
    });
  });

  describe('Serialization', () => {
    const DateVO = createDateVO({
      name: 'TestDate',
      errors: mockErrors,
    });

    it('should serialize to JSON correctly', () => {
      const result = DateVO.from('2024-01-15');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const json = result.value.toJSON();
        expect(json.type).toBe('TestDate');
        expect(json.value).toBe('2024-01-15T00:00:00.000Z');
      }
    });

    it('should convert to string correctly', () => {
      const result = DateVO.from('2024-01-15');
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.toString()).toContain('Jan 15 2024');
      }
    });
  });

  describe('Type Coercion with from() method', () => {
    const DateVO = createDateVO({
      name: 'TestDate',
      errors: mockErrors,
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-15');
      const result = DateVO.from(date);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toEqual(date);
      }
    });

    it('should handle valid ISO strings', () => {
      const result = DateVO.from('2024-01-15T10:30:00Z');
      expect(isOk(result)).toBe(true);
    });

    it('should reject invalid inputs', () => {
      const result = DateVO.from('not-a-date');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Required Configuration', () => {
    it('should reject undefined when required', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        required: true,
        errors: mockErrors,
      });

      const result = DateVO.create(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should reject null when required', () => {
      const DateVO = createDateVO({
        name: 'TestDate',
        required: true,
        errors: mockErrors,
      });

      const result = DateVO.create(null);
      expect(isErr(result)).toBe(true);
    });
  });
});
