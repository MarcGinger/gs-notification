import { createTimeVO, createTimeVOErrors } from '../time.vo';
import { DomainError, isOk, isErr, ok, err } from '../../../errors';

describe('TimeVO Factory', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'TIME_TEST_ERROR',
    title: 'Time test error',
    category: 'validation',
  };

  const mockErrors = createTimeVOErrors(mockBaseError, 'TestTime');

  describe('Basic Creation', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    it('should create time VO with valid Date object', () => {
      const date = new Date();
      date.setHours(14, 30, 45, 500);
      const result = TimeVO.create(date);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.hours).toBe(14);
        expect(result.value.minutes).toBe(30);
        expect(result.value.seconds).toBe(45);
        expect(result.value.milliseconds).toBe(500);
      }
    });

    it('should create time VO from time string (HH:MM:SS)', () => {
      const result = TimeVO.from('14:30:45');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.hours).toBe(14);
        expect(result.value.minutes).toBe(30);
        expect(result.value.seconds).toBe(45);
        expect(result.value.milliseconds).toBe(0);
      }
    });

    it('should create time VO from time string with milliseconds (HH:MM:SS.mmm)', () => {
      const result = TimeVO.from('09:15:30.250');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.hours).toBe(9);
        expect(result.value.minutes).toBe(15);
        expect(result.value.seconds).toBe(30);
        expect(result.value.milliseconds).toBe(250);
      }
    });

    it('should create time VO from number (milliseconds since epoch)', () => {
      const timestamp = new Date().setHours(10, 20, 30, 0);
      const result = TimeVO.from(timestamp);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.hours).toBe(10);
        expect(result.value.minutes).toBe(20);
        expect(result.value.seconds).toBe(30);
      }
    });

    it('should create time VO using now() method', () => {
      const result = TimeVO.now();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const now = new Date();
        expect(result.value.hours).toBe(now.getHours());
        expect(result.value.minutes).toBe(now.getMinutes());
      }
    });

    it('should fail with invalid time string', () => {
      const result = TimeVO.from('25:70:90');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('TIME_TEST_ERROR');
      }
    });

    it('should fail with invalid type', () => {
      const result = TimeVO.from({} as any);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('TIME_TEST_ERROR');
      }
    });

    it('should fail with null value when not required', () => {
      const result = TimeVO.create(null);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('TIME_TEST_ERROR');
      }
    });
  });

  describe('Validation', () => {
    it('should validate minimum time constraint', () => {
      const TimeVO = createTimeVO({
        name: 'BusinessHours',
        minTime: new Date(1970, 0, 1, 9, 0), // 9:00 AM
        errors: mockErrors,
      });

      const earlyTime = new Date();
      earlyTime.setHours(8, 30); // 8:30 AM - too early
      const result = TimeVO.create(earlyTime);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('TIME_TEST_ERROR');
        expect(result.error.detail).toContain('cannot be before');
      }
    });

    it('should validate maximum time constraint', () => {
      const TimeVO = createTimeVO({
        name: 'BusinessHours',
        maxTime: new Date(1970, 0, 1, 17, 0), // 5:00 PM
        errors: mockErrors,
      });

      const lateTime = new Date();
      lateTime.setHours(18, 30); // 6:30 PM - too late
      const result = TimeVO.create(lateTime);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('TIME_TEST_ERROR');
        expect(result.error.detail).toContain('cannot be after');
      }
    });

    it('should validate required constraint', () => {
      const TimeVO = createTimeVO({
        name: 'RequiredTime',
        required: true,
        errors: {
          ...mockErrors,
          required: () => ({ ...mockBaseError, detail: 'Time is required' }),
        },
      });

      const result = TimeVO.create(undefined);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toBe('Time is required');
      }
    });

    it('should pass validation within constraints', () => {
      const TimeVO = createTimeVO({
        name: 'BusinessHours',
        minTime: new Date(1970, 0, 1, 9, 0), // 9:00 AM
        maxTime: new Date(1970, 0, 1, 17, 0), // 5:00 PM
        errors: mockErrors,
      });

      const validTime = new Date();
      validTime.setHours(14, 30); // 2:30 PM - within business hours
      const result = TimeVO.create(validTime);

      expect(isOk(result)).toBe(true);
    });
  });

  describe('Refinements', () => {
    it('should apply business rule refinements', () => {
      const TimeVO = createTimeVO({
        name: 'LunchTime',
        refinements: [
          {
            name: 'lunch_hours',
            test: (value: Date) =>
              value.getHours() >= 12 && value.getHours() <= 14,
            createError: (value: Date) => ({
              ...mockBaseError,
              detail: `Lunch time must be between 12:00 and 14:00, got ${value.toTimeString()}`,
            }),
          },
        ],
        errors: mockErrors,
      });

      const earlyLunch = new Date();
      earlyLunch.setHours(11, 30); // 11:30 AM - too early for lunch
      const result = TimeVO.create(earlyLunch);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toContain('Lunch time must be between');
      }
    });

    it('should pass refinement validation', () => {
      const TimeVO = createTimeVO({
        name: 'LunchTime',
        refinements: [
          {
            name: 'lunch_hours',
            test: (value: Date) =>
              value.getHours() >= 12 && value.getHours() <= 14,
            createError: (value: Date) => ({ ...mockBaseError }),
          },
        ],
        errors: mockErrors,
      });

      const validLunch = new Date();
      validLunch.setHours(12, 30); // 12:30 PM - valid lunch time
      const result = TimeVO.create(validLunch);

      expect(isOk(result)).toBe(true);
    });
  });

  describe('Custom Validation', () => {
    it('should apply custom validation function', () => {
      const TimeVO = createTimeVO({
        name: 'CustomTime',
        customValidation: (value: Date) => {
          if (value.getMinutes() % 15 !== 0) {
            return err({
              ...mockBaseError,
              detail: 'Time must be on 15-minute intervals',
            });
          }
          return ok(undefined);
        },
        errors: mockErrors,
      });

      const invalidTime = new Date();
      invalidTime.setHours(10, 17); // 10:17 - not on 15-minute interval
      const result = TimeVO.create(invalidTime);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.detail).toBe('Time must be on 15-minute intervals');
      }
    });

    it('should pass custom validation', () => {
      const TimeVO = createTimeVO({
        name: 'CustomTime',
        customValidation: (value: Date) => {
          if (value.getMinutes() % 15 !== 0) {
            return err({ ...mockBaseError });
          }
          return ok(undefined);
        },
        errors: mockErrors,
      });

      const validTime = new Date();
      validTime.setHours(10, 15); // 10:15 - on 15-minute interval
      const result = TimeVO.create(validTime);

      expect(isOk(result)).toBe(true);
    });
  });

  describe('Accessors', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    let timeVO: any;

    beforeEach(() => {
      const date = new Date();
      date.setHours(14, 30, 45, 500);
      const result = TimeVO.create(date);
      if (isOk(result)) {
        timeVO = result.value;
      }
    });

    it('should provide hours accessor', () => {
      expect(timeVO.hours).toBe(14);
    });

    it('should provide minutes accessor', () => {
      expect(timeVO.minutes).toBe(30);
    });

    it('should provide seconds accessor', () => {
      expect(timeVO.seconds).toBe(45);
    });

    it('should provide milliseconds accessor', () => {
      expect(timeVO.milliseconds).toBe(500);
    });

    it('should provide totalMilliseconds accessor', () => {
      const expected = 14 * 3600000 + 30 * 60000 + 45 * 1000 + 500;
      expect(timeVO.totalMilliseconds).toBe(expected);
    });

    it('should provide totalSeconds accessor', () => {
      const expected = Math.floor(
        (14 * 3600000 + 30 * 60000 + 45 * 1000 + 500) / 1000,
      );
      expect(timeVO.totalSeconds).toBe(expected);
    });

    it('should provide totalMinutes accessor', () => {
      const expected = Math.floor(
        (14 * 3600000 + 30 * 60000 + 45 * 1000 + 500) / 60000,
      );
      expect(timeVO.totalMinutes).toBe(expected);
    });
  });

  describe('Operations', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    let timeVO: any;

    beforeEach(() => {
      const date = new Date();
      date.setHours(10, 30, 45, 500);
      const result = TimeVO.create(date);
      if (isOk(result)) {
        timeVO = result.value;
      }
    });

    it('should add hours correctly', () => {
      const result = timeVO.addHours(2);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect((result as any).value.hours).toBe(12);

        expect((result as any).value.minutes).toBe(30);

        expect((result as any).value.seconds).toBe(45);

        expect((result as any).value.milliseconds).toBe(500);
      }
    });

    it('should add minutes correctly', () => {
      const result = timeVO.addMinutes(30);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect((result as any).value.hours).toBe(11);

        expect((result as any).value.minutes).toBe(0);

        expect((result as any).value.seconds).toBe(45);

        expect((result as any).value.milliseconds).toBe(500);
      }
    });

    it('should add seconds correctly', () => {
      const result = timeVO.addSeconds(15);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect((result as any).value.hours).toBe(10);

        expect((result as any).value.minutes).toBe(31);

        expect((result as any).value.seconds).toBe(0);

        expect((result as any).value.milliseconds).toBe(500);
      }
    });

    it('should add milliseconds correctly', () => {
      const result = timeVO.addMilliseconds(500);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect((result as any).value.hours).toBe(10);

        expect((result as any).value.minutes).toBe(30);

        expect((result as any).value.seconds).toBe(46);

        expect((result as any).value.milliseconds).toBe(0);
      }
    });

    it('should validate result of operations', () => {
      const TimeVOWithMax = createTimeVO({
        name: 'ConstrainedTime',
        maxTime: new Date(1970, 0, 1, 15, 0), // 3:00 PM
        errors: mockErrors,
      });

      const constrainedTime = new Date();
      constrainedTime.setHours(14, 0);
      const createResult = TimeVOWithMax.create(constrainedTime);
      expect(isOk(createResult)).toBe(true);

      if (isOk(createResult)) {
        const addResult = createResult.value.addHours(2); // Would be 4:00 PM - invalid
        expect(isErr(addResult)).toBe(true);
      }
    });
  });

  describe('Comparisons', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    let time1: any, time2: any, time3: any;

    beforeEach(() => {
      const date1 = new Date();
      date1.setHours(10, 30, 0, 0);
      const date2 = new Date();
      date2.setHours(10, 30, 0, 0); // Same as time1
      const date3 = new Date();
      date3.setHours(14, 45, 0, 0); // Different

      const result1 = TimeVO.create(date1);
      const result2 = TimeVO.create(date2);
      const result3 = TimeVO.create(date3);

      if (isOk(result1)) time1 = result1.value;
      if (isOk(result2)) time2 = result2.value;
      if (isOk(result3)) time3 = result3.value;
    });

    it('should check equality correctly', () => {
      expect(time1.equals(time2)).toBe(true);
      expect(time1.equals(time3)).toBe(false);
    });

    it('should check exact equality correctly', () => {
      expect(time1.exactEquals(time2)).toBe(true);
      expect(time1.exactEquals(time3)).toBe(false);
    });

    it('should compare times correctly', () => {
      expect(time1.compare(time2)).toBe(0);
      expect(time1.compare(time3)).toBe(-1);
      expect(time3.compare(time1)).toBe(1);
    });

    it('should check isBefore correctly', () => {
      expect(time1.isBefore(time3)).toBe(true);
      expect(time3.isBefore(time1)).toBe(false);
      expect(time1.isBefore(time2)).toBe(false);
    });

    it('should check isAfter correctly', () => {
      expect(time3.isAfter(time1)).toBe(true);
      expect(time1.isAfter(time3)).toBe(false);
      expect(time1.isAfter(time2)).toBe(false);
    });
  });

  describe('Differences', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    let time1: any, time2: any;

    beforeEach(() => {
      const date1 = new Date();
      date1.setHours(10, 30, 0, 0);
      const date2 = new Date();
      date2.setHours(14, 45, 30, 0); // 4 hours, 15 minutes, 30 seconds later

      const result1 = TimeVO.create(date1);
      const result2 = TimeVO.create(date2);

      if (isOk(result1)) time1 = result1.value;
      if (isOk(result2)) time2 = result2.value;
    });

    it('should calculate difference in hours', () => {
      expect(time1.differenceInHours(time2)).toBe(4);
      expect(time2.differenceInHours(time1)).toBe(4);
    });

    it('should calculate difference in minutes', () => {
      expect(time1.differenceInMinutes(time2)).toBe(255); // 4*60 + 15
      expect(time2.differenceInMinutes(time1)).toBe(255);
    });

    it('should calculate difference in seconds', () => {
      expect(time1.differenceInSeconds(time2)).toBe(15330); // 4*3600 + 15*60 + 30
      expect(time2.differenceInSeconds(time1)).toBe(15330);
    });

    it('should calculate difference in milliseconds', () => {
      expect(time1.differenceInMilliseconds(time2)).toBe(15330000); // 4*3600000 + 15*60000 + 30*1000
      expect(time2.differenceInMilliseconds(time1)).toBe(15330000);
    });
  });

  describe('Serialization', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    let timeVO: any;

    beforeEach(() => {
      const date = new Date();
      date.setHours(14, 30, 45, 500);
      const result = TimeVO.create(date);
      if (isOk(result)) {
        timeVO = result.value;
      }
    });

    it('should serialize to ISO string', () => {
      const iso = timeVO.toISOString();
      expect(iso).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should serialize to time string', () => {
      const timeString = timeVO.toTimeString();
      expect(timeString).toBe('14:30:45.500');
    });

    it('should serialize to string', () => {
      const str = timeVO.toString();
      expect(str).toBe('14:30:45.500');
    });

    it('should serialize to JSON', () => {
      const json = timeVO.toJSON();
      expect(json).toEqual({
        value: '14:30:45.500',
        type: 'TestTime',
      });
    });
  });

  describe('Edge Cases', () => {
    const TimeVO = createTimeVO({
      name: 'TestTime',
      errors: mockErrors,
    });

    it('should handle midnight correctly', () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const result = TimeVO.create(midnight);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.hours).toBe(0);
        expect(result.value.minutes).toBe(0);
        expect(result.value.seconds).toBe(0);
        expect(result.value.milliseconds).toBe(0);
        expect(result.value.totalMilliseconds).toBe(0);
      }
    });

    it('should handle 23:59:59.999 correctly', () => {
      const almostMidnight = new Date();
      almostMidnight.setHours(23, 59, 59, 999);
      const result = TimeVO.create(almostMidnight);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.hours).toBe(23);
        expect(result.value.minutes).toBe(59);
        expect(result.value.seconds).toBe(59);
        expect(result.value.milliseconds).toBe(999);
      }
    });

    it('should handle time rollover correctly in operations', () => {
      const TimeVO = createTimeVO({
        name: 'TestTime',
        errors: mockErrors,
      });

      const lateTime = new Date();
      lateTime.setHours(23, 30);
      const result = TimeVO.create(lateTime);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const nextHour = result.value.addHours(1);
        expect(isOk(nextHour)).toBe(true);
        if (isOk(nextHour)) {
          expect(nextHour.value.hours).toBe(0); // Rolled over to midnight
          expect(nextHour.value.minutes).toBe(30);
        }
      }
    });
  });
});
