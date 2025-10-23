// Shared clock interface and simple implementations used by domain code.
// Keep this file free of Nest/DI concerns — providers belong in infrastructure.

import { parseIsoUtcStrictSafe } from './iso';
import { DomainError, Result, ok, err, withContext } from '../../errors';

export type IsoDateString = string;

/**
 * Clock Error Definitions
 * Defines all errors that can occur during clock operations
 */
const ClockErrorDefinitions = {
  INVALID_DATE: {
    title: 'Invalid Date',
    detail: 'Invalid date provided to clock operation',
    category: 'validation' as const,
    retryable: false,
  },

  INVALID_ADVANCE_PARAMETER: {
    title: 'Invalid Advance Parameter',
    detail: 'Invalid parameter provided to advance operation',
    category: 'validation' as const,
    retryable: false,
  },
} as const;

/**
 * Clock error catalog with namespaced error codes
 */
const ClockErrors = Object.fromEntries(
  Object.entries(ClockErrorDefinitions).map(([key, errorDef]) => {
    const code = `CLOCK.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof ClockErrorDefinitions]: DomainError<`CLOCK.${Extract<K, string>}`>;
};

export interface Clock {
  // Returns a Date object. Implementations should return a defensive copy.
  now(): Date;

  // ISO-8601 UTC string for use in event metadata (toISOString())
  nowIso(): IsoDateString;

  // Numeric epoch millis for hot paths that prefer numbers over Date objects.
  nowMs(): number;
}

/** Small base providing nowIso/nowMs implementations to callers. */
export abstract class BaseClock implements Clock {
  abstract now(): Date;
  nowIso(): IsoDateString {
    return this.now().toISOString();
  }
  nowMs(): number {
    return this.now().getTime();
  }
}

/**
 * SystemClock - production clock backed by system time.
 */
export class SystemClock extends BaseClock {
  now(): Date {
    return new Date();
  }
}

/**
 * FixedClock - deterministic clock for tests and replays. Accepts Date or strict ISO string.
 */
export class FixedClock extends BaseClock {
  private current: Date;

  /**
   * Safe constructor that returns Result instead of throwing
   */
  static createSafe(current: Date | string): Result<FixedClock, DomainError> {
    try {
      let d: Date;
      if (typeof current === 'string') {
        const parseResult = parseIsoUtcStrictSafe(current);
        if (!parseResult.ok) {
          return err(parseResult.error);
        }
        d = parseResult.value;
      } else {
        d = new Date(current);
      }

      if (Number.isNaN(d.getTime())) {
        return err(
          withContext(ClockErrors.INVALID_DATE, {
            operation: 'FixedClock.create',
            input: String(current),
            inputType: typeof current,
            reason: 'Invalid date value',
          }),
        );
      }

      // Create instance directly with validated date
      const instance = Object.create(FixedClock.prototype) as FixedClock;
      // Use reflection to set private property without going through constructor
      Object.defineProperty(instance, 'current', {
        value: new Date(d.getTime()),
        writable: true,
        enumerable: false,
        configurable: false,
      });
      return ok(instance);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err(
        withContext(ClockErrors.INVALID_DATE, {
          operation: 'FixedClock.create',
          input: String(current),
          inputType: typeof current,
          reason: errorMessage,
        }),
      );
    }
  }

  now(): Date {
    // Return a copy to avoid external mutation of the internal clock state.
    return new Date(this.current.getTime());
  }

  /**
   * Safe set method that returns Result instead of throwing
   */
  setSafe(d: Date | string): Result<void, DomainError> {
    try {
      let next: Date;
      if (typeof d === 'string') {
        const parseResult = parseIsoUtcStrictSafe(d);
        if (!parseResult.ok) {
          return err(parseResult.error);
        }
        next = parseResult.value;
      } else {
        next = new Date(d);
      }

      if (Number.isNaN(next.getTime())) {
        return err(
          withContext(ClockErrors.INVALID_DATE, {
            operation: 'FixedClock.set',
            input: String(d),
            inputType: typeof d,
            reason: 'Invalid date value',
          }),
        );
      }
      this.current = new Date(next.getTime());
      return ok(void 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err(
        withContext(ClockErrors.INVALID_DATE, {
          operation: 'FixedClock.set',
          input: String(d),
          inputType: typeof d,
          reason: errorMessage,
        }),
      );
    }
  }

  /**
   * Safe advance method that returns Result instead of throwing
   */
  advanceSafe(ms: number): Result<void, DomainError> {
    if (!Number.isFinite(ms)) {
      return err(
        withContext(ClockErrors.INVALID_ADVANCE_PARAMETER, {
          operation: 'FixedClock.advance',
          parameter: String(ms),
          parameterType: typeof ms,
          isFinite: Number.isFinite(ms),
        }),
      );
    }
    this.current = new Date(this.current.getTime() + ms);
    return ok(void 0);
  }
}

/** Monotonic wrapper: never returns a time less than the previous returned time. */
export class MonotonicClock implements Clock {
  private lastMs = -Infinity;
  constructor(private readonly inner: Clock) {}
  private nextMs(): number {
    const ms = this.inner.nowMs();
    this.lastMs = Math.max(ms, this.lastMs + 1);
    return this.lastMs;
  }
  now(): Date {
    return new Date(this.nextMs());
  }
  nowIso(): IsoDateString {
    return new Date(this.nextMs()).toISOString();
  }
  nowMs(): number {
    return this.nextMs();
  }
}

/** Auto-advance clock: advances a small step each call to avoid identical timestamps in tests. */
export class AutoAdvanceClock extends FixedClock {
  private stepMs: number;

  /**
   * Safe constructor for AutoAdvanceClock
   */
  static createSafe(
    seed: Date | string,
    stepMs = 1,
  ): Result<AutoAdvanceClock, DomainError> {
    const fixedResult = FixedClock.createSafe(seed);
    if (!fixedResult.ok) {
      return fixedResult;
    }

    // Create AutoAdvanceClock instance by extending the successful FixedClock
    const instance = Object.create(
      AutoAdvanceClock.prototype,
    ) as AutoAdvanceClock;

    // Access the validated current property directly
    const currentDate = fixedResult.value.now(); // Use public method instead of private property
    Object.defineProperty(instance, 'current', {
      value: new Date(currentDate.getTime()),
      writable: true,
      enumerable: false,
      configurable: false,
    });
    Object.defineProperty(instance, 'stepMs', {
      value: stepMs,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return ok(instance);
  }

  override now(): Date {
    const d = super.now();
    const result = this.advanceSafe(this.stepMs);
    // In this context, we expect advance to always succeed since stepMs is validated at construction
    // If it fails, it indicates a serious internal error
    if (!result.ok) {
      // INTENTIONAL THROW: Clock interface requires Date return, not Result<Date>
      // This represents an internal consistency violation that should never happen
      throw new Error(
        `AutoAdvanceClock internal error: ${result.error.detail}`,
      );
    }
    return d;
  }
  override nowIso(): IsoDateString {
    const s = super.nowIso();
    const result = this.advanceSafe(this.stepMs);
    if (!result.ok) {
      // INTENTIONAL THROW: Clock interface constraint - internal error must be visible
      throw new Error(
        `AutoAdvanceClock internal error: ${result.error.detail}`,
      );
    }
    return s;
  }
  override nowMs(): number {
    const ms = super.nowMs();
    const result = this.advanceSafe(this.stepMs);
    if (!result.ok) {
      // INTENTIONAL THROW: Clock interface constraint - internal error must be visible
      throw new Error(
        `AutoAdvanceClock internal error: ${result.error.detail}`,
      );
    }
    return ms;
  }
}

// Do NOT export a runtime SystemClock instance from this file.
// Keep `clock.ts` focused on types and implementations; export the runtime
// `systemClock` from `src/shared/time/convenience.ts` instead to discourage
// accidental domain imports of the runtime instance.
