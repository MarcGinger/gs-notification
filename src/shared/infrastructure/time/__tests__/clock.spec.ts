import {
  SystemClock,
  FixedClock,
  MonotonicClock,
  AutoAdvanceClock,
} from '../clock';

describe('Clock implementations', () => {
  test('SystemClock.nowMs returns a recent timestamp', () => {
    const sys = new SystemClock();
    const before = Date.now();
    const ms = sys.nowMs();
    const after = Date.now();

    expect(ms).toBeGreaterThanOrEqual(before - 1);
    expect(ms).toBeLessThanOrEqual(after + 1);
  });

  // Helper to produce a safe string from unknown error-like objects for test throws
  const safeErrorMessage = (e: unknown): string => {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object' && 'detail' in e) {
      const obj = e as Record<string, unknown>;
      const d = obj.detail;
      if (typeof d === 'string') return d;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  };

  test('FixedClock returns deterministic values and supports set/advance', () => {
    const iso = '2025-08-16T10:00:00.000Z';
    const fcRes = FixedClock.createSafe(iso);
    expect(fcRes.ok).toBe(true);
    if (!fcRes.ok) throw new Error(safeErrorMessage(fcRes.error));
    const fc = fcRes.value;

    expect(fc.nowIso()).toBe(new Date(iso).toISOString());
    expect(fc.nowMs()).toBe(new Date(iso).getTime());

    // advance by 1000ms
    const adv = fc.advanceSafe(1000);
    expect(adv.ok).toBe(true);
    expect(fc.nowMs()).toBe(new Date(iso).getTime() + 1000);

    // set to a new time
    const set = fc.setSafe('2025-08-16T11:00:00.000Z');
    expect(set.ok).toBe(true);
    expect(fc.nowIso()).toBe(
      new Date('2025-08-16T11:00:00.000Z').toISOString(),
    );

    // invalid advance should be an error result
    const badAdv = fc.advanceSafe(Number.POSITIVE_INFINITY);
    expect(badAdv.ok).toBe(false);
  });

  test('FixedClock throws for invalid constructor/set/advance inputs', () => {
    // constructor should return error for invalid ISO (strict parser message)
    const bad = FixedClock.createSafe('not-a-valid-iso');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.detail).toMatch(
        /Date string does not match required ISO-8601 UTC format/,
      );
    }

    const fcRes = FixedClock.createSafe('2025-08-16T10:00:00.000Z');
    expect(fcRes.ok).toBe(true);
    if (!fcRes.ok) throw new Error(safeErrorMessage(fcRes.error));
    const fc = fcRes.value;

    // set should return an error result for invalid ISO
    const setRes = fc.setSafe('also-not-a-date');
    expect(setRes.ok).toBe(false);
    // advance should return error for non-finite numbers (NaN)
    const advRes = fc.advanceSafe(Number.NaN);
    expect(advRes.ok).toBe(false);
  });

  test('MonotonicClock never goes backwards even if inner clock is stable', () => {
    const seed = '2025-08-16T10:00:00.000Z';
    const fcRes = FixedClock.createSafe(seed);
    expect(fcRes.ok).toBe(true);
    if (!fcRes.ok) throw new Error(safeErrorMessage(fcRes.error));
    const fc = fcRes.value;
    const mono = new MonotonicClock(fc);

    const t1 = mono.nowMs();
    const t2 = mono.nowMs();
    const t3 = mono.nowMs();

    expect(t2).toBeGreaterThanOrEqual(t1);
    expect(t3).toBeGreaterThanOrEqual(t2);
    // Because inner FixedClock returns same ms, monotonic should increment at least by 1
    expect(t2 - t1).toBeGreaterThanOrEqual(1);
  });

  test('AutoAdvanceClock advances automatically on each call', () => {
    const seed = '2025-08-16T10:00:00.000Z';
    const autoRes = AutoAdvanceClock.createSafe(seed, 5);
    expect(autoRes.ok).toBe(true);
    if (!autoRes.ok) throw new Error(safeErrorMessage(autoRes.error));
    const auto = autoRes.value;

    const a1 = auto.nowMs();
    const a2 = auto.nowMs();
    expect(a2).toBeGreaterThan(a1);
    expect(a2 - a1).toBeGreaterThanOrEqual(5);
  });
});
