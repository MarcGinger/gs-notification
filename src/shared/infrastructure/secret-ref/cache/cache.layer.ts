import { ResolvedSecret, SecretRef } from '../secret-ref.types';

export abstract class CacheLayer {
  abstract buildKey(ref: SecretRef): string;
  abstract get(key: string): Promise<ResolvedSecret | null>;
  abstract set(
    key: string,
    value: ResolvedSecret,
    opts: { ttlMs: number; jitterPct?: number },
  ): Promise<void>;

  computeTtl(_ref: SecretRef, result: ResolvedSecret, maxTtlMs = 15 * 60_000) {
    // If provider gives expiry, cap by maxTtl; else short default with jitter
    const base = result.expiresAt
      ? Math.max(1_000, Math.min(result.expiresAt - Date.now(), maxTtlMs))
      : 5 * 60_000;
    return base;
  }
}
