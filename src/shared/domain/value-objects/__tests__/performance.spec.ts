import { createStringVO, createIntegerVO, createBooleanVO } from '../index';
import { DomainError } from '../../../errors';

describe('Value Objects Performance Tests', () => {
  // Mock base error for testing
  const mockBaseError: DomainError = {
    code: 'PERFORMANCE_TEST_ERROR',
    title: 'Performance test error',
    category: 'validation',
  };

  describe('Creation Performance', () => {
    it('should create StringVO instances efficiently', () => {
      const StringVO = createStringVO({
        name: 'PerfTestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const iterations = 10000;
      const values = Array.from(
        { length: iterations },
        (_, i) => `test-string-${i}`,
      );

      const startTime = performance.now();

      for (const value of values) {
        StringVO.create(value);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `StringVO Creation: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `StringVO Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 1000 operations per second
      expect(operationsPerSecond).toBeGreaterThan(1000);

      // Should complete within reasonable time (less than 10 seconds for 10k operations)
      expect(duration).toBeLessThan(10000);
    });

    it('should create IntegerVO instances efficiently', () => {
      const IntegerVO = createIntegerVO({
        name: 'PerfTestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const iterations = 10000;
      const values = Array.from({ length: iterations }, (_, i) => i);

      const startTime = performance.now();

      for (const value of values) {
        IntegerVO.create(value);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `IntegerVO Creation: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `IntegerVO Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 1000 operations per second
      expect(operationsPerSecond).toBeGreaterThan(1000);

      // Should complete within reasonable time (less than 10 seconds for 10k operations)
      expect(duration).toBeLessThan(10000);
    });

    it('should create BooleanVO instances efficiently', () => {
      const BooleanVO = createBooleanVO({
        name: 'PerfTestBoolean',
        errors: {
          type: () => mockBaseError,
          invalid: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const iterations = 10000;
      const values = Array.from({ length: iterations }, (_, i) => i % 2 === 0);

      const startTime = performance.now();

      for (const value of values) {
        BooleanVO.create(value);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `BooleanVO Creation: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `BooleanVO Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 1000 operations per second
      expect(operationsPerSecond).toBeGreaterThan(1000);

      // Should complete within reasonable time (less than 10 seconds for 10k operations)
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Validation Performance', () => {
    it('should validate StringVO efficiently with complex rules', () => {
      const StringVO = createStringVO({
        name: 'ComplexValidationString',
        minLength: 5,
        maxLength: 100,
        pattern: /^[A-Za-z0-9\s-_.]+$/,
        trim: true,
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const iterations = 1000;
      const validValue = 'Valid Test String With Numbers 123';

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        StringVO.create(validValue);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `Complex StringVO Validation: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `Complex Validation Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 500 operations per second (more complex validation)
      expect(operationsPerSecond).toBeGreaterThan(500);

      // Should complete within reasonable time (less than 5 seconds for 1k operations)
      expect(duration).toBeLessThan(5000);
    });

    it('should validate IntegerVO efficiently with range constraints', () => {
      const IntegerVO = createIntegerVO({
        name: 'RangeConstrainedInteger',
        min: 0,
        max: 1000000,
        allowNegative: false,
        allowZero: true,
        allowDecimals: false,
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const iterations = 1000;
      const validValue = 42;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        IntegerVO.create(validValue);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `Range Constrained IntegerVO: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `Range Validation Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 500 operations per second (more complex validation)
      expect(operationsPerSecond).toBeGreaterThan(500);

      // Should complete within reasonable time (less than 5 seconds for 1k operations)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Method Performance', () => {
    it('should execute equals method efficiently', () => {
      const StringVO = createStringVO({
        name: 'EqualsTestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const vo1Result = StringVO.create('test-value');
      const vo2Result = StringVO.create('test-value');

      if (!vo1Result.ok || !vo2Result.ok) {
        throw new Error('Failed to create test VOs');
      }

      const vo1 = vo1Result.value;
      const vo2 = vo2Result.value;
      const iterations = 100000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        vo1.equals(vo2);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `Equals Method: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `Equals Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 10000 operations per second (simple comparison)
      expect(operationsPerSecond).toBeGreaterThan(10000);

      // Should complete within reasonable time (less than 3 seconds for 100k operations)
      expect(duration).toBeLessThan(3000);
    });

    it('should execute toString method efficiently', () => {
      const IntegerVO = createIntegerVO({
        name: 'ToStringTestInteger',
        errors: {
          type: () => mockBaseError,
          notFinite: () => mockBaseError,
          tooSmall: () => mockBaseError,
          tooLarge: () => mockBaseError,
          tooManyDecimals: () => mockBaseError,
          negativeNotAllowed: () => mockBaseError,
          zeroNotAllowed: () => mockBaseError,
          decimalsNotAllowed: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      const voResult = IntegerVO.create(12345);

      if (!voResult.ok) {
        throw new Error('Failed to create test VO');
      }

      const vo = voResult.value;
      const iterations = 100000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        vo.toString();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = iterations / (duration / 1000);

      console.log(
        `ToString Method: ${iterations} operations in ${duration.toFixed(2)}ms`,
      );
      console.log(
        `ToString Performance: ${operationsPerSecond.toFixed(0)} ops/sec`,
      );

      // Should complete at least 10000 operations per second (simple conversion)
      expect(operationsPerSecond).toBeGreaterThan(10000);

      // Should complete within reasonable time (less than 3 seconds for 100k operations)
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Memory Performance', () => {
    it('should not cause memory leaks during bulk creation', () => {
      const StringVO = createStringVO({
        name: 'MemoryTestString',
        errors: {
          type: () => mockBaseError,
          empty: () => mockBaseError,
          tooShort: () => mockBaseError,
          tooLong: () => mockBaseError,
          pattern: () => mockBaseError,
          required: () => mockBaseError,
        },
      });

      // Force garbage collection if available (for memory testing)
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 10000;
      const vos: any[] = [];

      // Create many VOs
      for (let i = 0; i < iterations; i++) {
        const result = StringVO.create(`test-string-${i}`);
        if (result.ok) {
          vos.push(result.value);
        }
      }

      const afterCreationMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterCreationMemory - initialMemory;
      const memoryPerVO = memoryIncrease / iterations;

      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB for ${iterations} VOs`,
      );
      console.log(`Memory per VO: ${memoryPerVO.toFixed(0)} bytes`);

      // Each VO should use reasonable amount of memory (less than 1KB per VO)
      expect(memoryPerVO).toBeLessThan(1024);

      // Total memory increase should be reasonable (less than 50MB for 10k VOs)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Clear references to help GC
      vos.length = 0;
    });
  });
});
