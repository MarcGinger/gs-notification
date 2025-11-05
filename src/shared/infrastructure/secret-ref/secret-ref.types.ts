// Domain-safe: serialize/deserialize this; never the plaintext value.
export interface SecretRef {
  scheme: 'secret';
  provider: 'doppler';
  tenant: string; // e.g., 'core'
  namespace: string; // e.g., 'notification'
  key: string; // e.g., 'slack/bot-token'
  version?: string; // 'latest' | '3'
  algHint?: string; // optional consumer hint
  checksum?: string; // non-secret integrity hint
  raw?: string; // canonical URI form
}

export interface ResolveOptions {
  requireVersion?: boolean;
  minTtlMs?: number;
  allowFallback?: boolean; // return stale cache if provider is temporarily down
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  burstAllowance: number;
}

export class SecretRefError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'POLICY_DENIED'
      | 'PROVIDER_ERROR'
      | 'CACHE_ERROR'
      | 'CONFIG_ERROR'
      | 'RATE_LIMIT_EXCEEDED',
    public readonly ref?: SecretRef,
  ) {
    super(message);
    this.name = 'SecretRefError';
  }
}

export interface ResolvedSecret {
  value: string; // ⚠️ never log
  version: string; // provider-resolved version
  expiresAt?: number; // epoch ms if provider exposes expiry
  providerLatencyMs: number;
  providerMeta?: Record<string, unknown>; // never includes value
}

export interface SecretMetadata {
  version: string;
  lastRotatedAt?: string;
  expiresAt?: string;
  provider: 'doppler';
}

export interface SecretResolutionContext {
  tenantId: string; // from ActorContext or execution context
  boundedContext: string; // e.g., 'notification'
  purpose: 'http-sign' | 'db-conn' | 'job-exec' | 'other';
  environment: 'development' | 'test' | 'staging' | 'production';
  rateLimitConfig?: RateLimitConfig;
}
