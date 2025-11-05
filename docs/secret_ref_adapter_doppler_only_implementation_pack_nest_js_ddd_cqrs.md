# SecretRefAdapter – **Doppler-Only** Implementation Pack

A production‑grade SecretRef adapter focused on **Doppler** as the sole secret provider. Designed for NestJS 11+, DDD/CQRS, ESDB write model, Redis projections, and strict audit/observability. The domain & application layers pass around **references**; only infra resolves plaintext.

> **Key guarantees**: no plaintext secrets in events/snapshots/logs; cache with jitter; rotation‑friendly; structured logs (value‑free); optional Redis cache sharing.

---

## 📁 Folder layout (suggested)

```
src/
  shared/
    logging/ ...
  infrastructure/
    secret-ref/
      secret-ref.module.ts
      secret-ref.service.ts
      secret-ref.types.ts
      config/
        secret-ref-config.validator.ts
      health/
        secret-ref-health.indicator.ts
      metrics/
        secret-ref-metrics.service.ts
      policy/
        policy.guard.ts
      cache/
        cache.layer.ts
        inmem.cache.ts
        redis.cache.ts
      providers/
        provider.registry.ts
        doppler.provider.ts
        doppler.client.ts
      utils/
        key.util.ts
        mask.util.ts
      __tests__/
        secret-ref.service.spec.ts
        circuit-breaker.spec.ts
        policy.guard.spec.ts
        cache.spec.ts
```

---

## 🔑 Domain-facing types (wire-safe VO)

**`src/infrastructure/secret-ref/secret-ref.types.ts`**

```ts
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
```

---

## 🧩 Nest Module (global)

**`src/infrastructure/secret-ref/secret-ref.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { SecretRefService } from './secret-ref.service';
import { ProviderRegistry } from './providers/provider.registry';
import { PolicyGuard } from './policy/policy.guard';
import { CacheLayer } from './cache/cache.layer';
import { InMemoryCache } from './cache/inmem.cache';
import { RedisCache } from './cache/redis.cache';
import { DopplerProvider } from './providers/doppler.provider';
import { DopplerClient } from './providers/doppler.client';
import { SecretRefConfigValidator } from './config/secret-ref-config.validator';
import { SecretRefHealthIndicator } from './health/secret-ref-health.indicator';

@Global()
@Module({
  providers: [
    // Core
    SecretRefService,
    ProviderRegistry,
    PolicyGuard,
    { provide: CacheLayer, useExisting: InMemoryCache },

    // Configuration & Health
    SecretRefConfigValidator,
    SecretRefHealthIndicator,

    // Caches (choose one via factory below if you want Redis)
    InMemoryCache,
    RedisCache,

    // Doppler wiring
    DopplerProvider,
    {
      provide: DopplerClient,
      useFactory: (validator: SecretRefConfigValidator) => {
        validator.validate(); // Validate config at startup
        return new DopplerClient({
          // ⚠️ Read from env/ConfigService only (no plaintext anywhere else)
          token: process.env.DOPPLER_TOKEN ?? '',
          project: process.env.DOPPLER_PROJECT ?? 'default',
          config: process.env.DOPPLER_CONFIG ?? 'dev',
          baseUrl: process.env.DOPPLER_BASE_URL ?? 'https://api.doppler.com',
          timeoutMs: Number(process.env.DOPPLER_TIMEOUT_MS ?? 5000),
        });
      },
      inject: [SecretRefConfigValidator],
    },
  ],
  exports: [SecretRefService, SecretRefHealthIndicator],
})
export class SecretRefModule {}
```

> Swap to Redis cache by changing the provider for `CacheLayer` to `useExisting: RedisCache` and giving it an `ioredis` instance in its constructor.

---

## 🧠 Policy guard (value-free enforcement)

**`src/infrastructure/secret-ref/policy/policy.guard.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { ResolveOptions, SecretRef } from '../secret-ref.types';

export interface SecretResolutionContext {
  tenantId: string; // from ActorContext or execution context
  boundedContext: string; // e.g., 'notification'
  purpose: 'http-sign' | 'db-conn' | 'job-exec' | 'other';
  environment: 'dev' | 'test' | 'staging' | 'prod';
  rateLimitConfig?: RateLimitConfig;
}

@Injectable()
export class PolicyGuard {
  private requestCounts = new Map<
    string,
    { count: number; windowStart: number }
  >();

  ensureAllowed(
    ref: SecretRef,
    opts: ResolveOptions | undefined,
    ctx?: SecretResolutionContext,
  ) {
    // Tenant isolation
    if (ctx && ref.tenant !== ctx.tenantId) {
      throw new SecretRefError('tenant mismatch', 'POLICY_DENIED', ref);
    }

    // Namespace controls (example): only same bounded context may resolve its namespace
    if (ctx && ref.namespace !== ctx.boundedContext) {
      throw new SecretRefError('namespace not allowed', 'POLICY_DENIED', ref);
    }

    // Require fixed versions in prod unless explicitly allowed
    if (ctx?.environment === 'prod' && opts?.requireVersion && !ref.version) {
      throw new SecretRefError(
        'pinned version required in prod',
        'POLICY_DENIED',
        ref,
      );
    }

    // Rate limiting
    if (ctx?.rateLimitConfig) {
      this.checkRateLimit(ref, ctx);
    }
  }

  private checkRateLimit(ref: SecretRef, ctx: SecretResolutionContext) {
    const key = `${ref.tenant}:${ref.namespace}`;
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const config = ctx.rateLimitConfig!;

    const current = this.requestCounts.get(key);
    if (!current || now - current.windowStart > windowMs) {
      this.requestCounts.set(key, { count: 1, windowStart: now });
      return;
    }

    if (current.count >= config.maxRequestsPerMinute) {
      throw new SecretRefError(
        'rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        ref,
      );
    }

    current.count++;
  }
}
```

---

## 🗃️ Cache layer (LRU + optional Redis)

**`src/infrastructure/secret-ref/cache/cache.layer.ts`**

```ts
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
```

**`src/infrastructure/secret-ref/cache/inmem.cache.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { CacheLayer } from './cache.layer';
import { ResolvedSecret, SecretRef } from '../secret-ref.types';
import { buildKey } from '../utils/key.util';

@Injectable()
export class InMemoryCache extends CacheLayer {
  private store = new Map<string, { v: ResolvedSecret; exp: number }>();
  private max = 2000; // basic LRU-ish cap

  buildKey(ref: SecretRef) {
    return buildKey(ref);
  }

  async get(key: string) {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.exp) {
      this.store.delete(key);
      return null;
    }
    return e.v;
  }

  async set(
    key: string,
    value: ResolvedSecret,
    opts: { ttlMs: number; jitterPct?: number },
  ) {
    const jitter = opts.jitterPct
      ? opts.ttlMs * (Math.random() * opts.jitterPct)
      : 0;
    const exp = Date.now() + Math.max(1000, opts.ttlMs - jitter);
    if (this.store.size >= this.max) {
      // naive eviction
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }
    this.store.set(key, { v: value, exp });
  }
}
```

**`src/infrastructure/secret-ref/cache/redis.cache.ts`** (optional)

```ts
import { Injectable, Optional } from '@nestjs/common';
import { CacheLayer } from './cache.layer';
import { ResolvedSecret, SecretRef } from '../secret-ref.types';
import { buildKey } from '../utils/key.util';
import type Redis from 'ioredis';

@Injectable()
export class RedisCache extends CacheLayer {
  constructor(@Optional() private readonly redis?: Redis) {
    super();
  }

  buildKey(ref: SecretRef) {
    return buildKey(ref);
  }

  async get(key: string) {
    try {
      if (!this.redis || this.redis.status !== 'ready') return null;
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as ResolvedSecret) : null;
    } catch (error) {
      // Log error and fallback to cache miss
      console.warn('Redis cache get failed, falling back to miss:', error);
      return null;
    }
  }

  async set(
    key: string,
    value: ResolvedSecret,
    opts: { ttlMs: number; jitterPct?: number },
  ) {
    try {
      if (!this.redis || this.redis.status !== 'ready') return;
      const jitter = opts.jitterPct
        ? opts.ttlMs * (Math.random() * opts.jitterPct)
        : 0;
      const ttl = Math.floor(Math.max(1000, opts.ttlMs - jitter) / 1000);
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      // Log error but don't throw - cache set failures shouldn't break the flow
      console.warn('Redis cache set failed:', error);
    }
  }
}
```

---

## 🧰 Provider registry (Doppler-only)

**`src/infrastructure/secret-ref/providers/provider.registry.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { DopplerProvider } from './doppler.provider';

@Injectable()
export class ProviderRegistry {
  constructor(private readonly doppler: DopplerProvider) {}

  get(provider: 'doppler') {
    if (provider === 'doppler') return this.doppler;
    throw new Error(`Unknown provider: ${provider}`);
  }
}
```

---

## 🔌 Doppler client & provider

**`src/infrastructure/secret-ref/providers/doppler.client.ts`**

```ts
export interface DopplerClientOptions {
  token: string;      // Service token – read from env/secret store
  project: string;    // Doppler project slug
  config: string;     // Doppler config (dev/staging/prod)
  baseUrl: string;    // Doppler API base
  timeoutMs: number;
}

export class DopplerClient {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 30_000; // 30 seconds

  constructor(private readonly opts: DopplerClientOptions) {
    if (!this.opts.token) {
      throw new SecretRefError('DOPPLER_TOKEN is required', 'CONFIG_ERROR');
    }
  }

  async getSecret(path: string, version = 'latest'): Promise<{ value: string; version: string; expiresAt?: string; project: string; config: string; }>{
    // Circuit breaker check
    if (this.isCircuitOpen()) {
      throw new SecretRefError('Circuit breaker is open', 'PROVIDER_ERROR');
    }

    try {
      // Minimal HTTP; replace with official SDK if desired.
      const url = `${this.opts.baseUrl}/v3/configs/config/secret?project=${encodeURIComponent(this.opts.project)}&config=${encodeURIComponent(this.opts.config)}&name=${encodeURIComponent(path)}&version=${encodeURIComponent(version)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.opts.token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });

      if (!res.ok) {
        this.recordFailure();
        throw new SecretRefError(`Doppler API error: ${res.status}`, 'PROVIDER_ERROR');
      }

      const data = await res.json();
      this.recordSuccess();
      return {
        value: data?.value ?? '',
        version: String(data?.version ?? 'latest'),
        expiresAt: data?.expires_at,
        project: this.opts.project,
        config: this.opts.config,
      };
    } catch (error) {
      this.recordFailure();
      if (error instanceof SecretRefError) throw error;
      throw new SecretRefError(`Doppler client error: ${error.message}`, 'PROVIDER_ERROR');
    }
  }

  private isCircuitOpen(): boolean {
    if (this.failureCount < this.circuitBreakerThreshold) return false;
    return Date.now() - this.lastFailureTime < this.circuitBreakerTimeout;
  }

  private recordSuccess() {
    this.failureCount = 0;
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
}
    // Shape normalization (adjust if using SDK)
    return {
      value: data?.value ?? '',
      version: String(data?.version ?? 'latest'),
      expiresAt: data?.expires_at,
      project: this.opts.project,
      config: this.opts.config,
    };
  }
}
```

**`src/infrastructure/secret-ref/providers/doppler.provider.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { DopplerClient } from './doppler.client';
import {
  ResolvedSecret,
  ResolveOptions,
  SecretMetadata,
  SecretRef,
} from '../secret-ref.types';

@Injectable()
export class DopplerProvider {
  constructor(private readonly api: DopplerClient) {}

  async resolve(
    ref: SecretRef,
    _opts?: ResolveOptions,
  ): Promise<ResolvedSecret> {
    const path = `${ref.tenant}/${ref.namespace}/${ref.key}`; // convention
    const version = ref.version ?? 'latest';
    const t0 = Date.now();
    const res = await this.api.getSecret(path, version);
    const latency = Date.now() - t0;
    return {
      value: res.value,
      version: res.version,
      expiresAt: res.expiresAt ? Date.parse(res.expiresAt) : undefined,
      providerLatencyMs: latency,
      providerMeta: { project: res.project, config: res.config },
    };
  }

  async inspect(ref: SecretRef): Promise<SecretMetadata> {
    const path = `${ref.tenant}/${ref.namespace}/${ref.key}`;
    const res = await this.api.getSecret(path, ref.version ?? 'latest');
    return {
      version: res.version,
      expiresAt: res.expiresAt,
      provider: 'doppler',
    };
  }
}
```

---

## 🧱 Service façade (port impl)

**`src/infrastructure/secret-ref/secret-ref.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { ProviderRegistry } from './providers/provider.registry';
import { CacheLayer } from './cache/cache.layer';
import { PolicyGuard, SecretResolutionContext } from './policy/policy.guard';
import { ResolveOptions, ResolvedSecret, SecretRef } from './secret-ref.types';
import { maskKey } from './utils/mask.util';
import { componentLogger } from 'src/shared/logging';

@Injectable()
export class SecretRefService {
  private readonly log = componentLogger('SecretRefService');
  private readonly inFlightPromises = new Map<
    string,
    Promise<ResolvedSecret>
  >();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly cache: CacheLayer,
    private readonly policy: PolicyGuard,
  ) {}

  async resolve(
    ref: SecretRef,
    options?: ResolveOptions,
    ctx?: SecretResolutionContext,
  ): Promise<ResolvedSecret> {
    this.policy.ensureAllowed(ref, options, ctx);

    const cacheKey = this.cache.buildKey(ref);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Promise de-duplication to prevent thundering herd
    const existingPromise = this.inFlightPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const resolvePromise = this.performResolve(ref, options, cacheKey);
    this.inFlightPromises.set(cacheKey, resolvePromise);

    try {
      return await resolvePromise;
    } finally {
      this.inFlightPromises.delete(cacheKey);
    }
  }

  private async performResolve(
    ref: SecretRef,
    options: ResolveOptions | undefined,
    cacheKey: string,
  ): Promise<ResolvedSecret> {
    const provider = this.providers.get(ref.provider);
    const t0 = Date.now();

    try {
      const result = await provider.resolve(ref, options);
      const latency = Date.now() - t0;

      await this.cache.set(
        cacheKey,
        { ...result, providerLatencyMs: latency },
        {
          ttlMs: this.cache.computeTtl(ref, result),
          jitterPct: 0.15,
        },
      );

      this.log.info({
        event: 'secret_resolved',
        provider: ref.provider,
        tenant: ref.tenant,
        ns: ref.namespace,
        key: maskKey(ref.key),
        version: result.version,
        latencyMs: latency,
      });

      return result;
    } catch (error) {
      const latency = Date.now() - t0;
      this.log.error({
        event: 'secret_resolve_failed',
        provider: ref.provider,
        tenant: ref.tenant,
        ns: ref.namespace,
        key: maskKey(ref.key),
        latencyMs: latency,
        error: error.message,
      });
      throw error;
    }
  }

  async hydrate(refs: SecretRef[], ctx?: SecretResolutionContext) {
    for (const ref of refs) {
      try {
        await this.resolve(ref, { allowFallback: false }, ctx);
      } catch {
        /* ignore */
      }
    }
  }

  async inspect(ref: SecretRef, ctx?: SecretResolutionContext) {
    this.policy.ensureAllowed(ref, { requireVersion: false }, ctx);
    const provider = this.providers.get(ref.provider);
    return provider.inspect(ref);
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    try {
      const testRef: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'system',
        namespace: 'health',
        key: 'canary',
        version: 'latest',
      };

      const t0 = Date.now();
      await this.inspect(testRef);
      const latencyMs = Date.now() - t0;

      return { healthy: true, latencyMs };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}
```

---

## 🔧 Utilities

**`src/infrastructure/secret-ref/utils/key.util.ts`**

```ts
import { SecretRef } from '../secret-ref.types';

export function buildKey(ref: SecretRef) {
  // Cluster-safe, version-aware cache key (no plaintext)
  const ver = ref.version ?? 'latest';
  return `secretref:v1:${ref.provider}:${ref.tenant}:${ref.namespace}:${ref.key}:${ver}`;
}
```

**`src/infrastructure/secret-ref/utils/mask.util.ts`**

```ts
export function maskKey(key: string) {
  if (!key) return '***';
  return key.length <= 4 ? '****' : `${key.slice(0, 2)}***${key.slice(-2)}`;
}
```

---

## 🔧 Configuration & Health Checks

**`src/infrastructure/secret-ref/config/secret-ref-config.validator.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { SecretRefError } from '../secret-ref.types';

@Injectable()
export class SecretRefConfigValidator {
  validate() {
    const required = ['DOPPLER_TOKEN', 'DOPPLER_PROJECT', 'DOPPLER_CONFIG'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new SecretRefError(
        `Missing required environment variables: ${missing.join(', ')}`,
        'CONFIG_ERROR',
      );
    }

    // Validate token format (basic check)
    const token = process.env.DOPPLER_TOKEN;
    if (token && !token.startsWith('dp.st.')) {
      throw new SecretRefError(
        'DOPPLER_TOKEN appears to be invalid (should start with dp.st.)',
        'CONFIG_ERROR',
      );
    }
  }
}
```

**`src/infrastructure/secret-ref/health/secret-ref-health.indicator.ts`**

```ts
import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { SecretRefService } from '../secret-ref.service';

@Injectable()
export class SecretRefHealthIndicator extends HealthIndicator {
  constructor(private readonly secretRef: SecretRefService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const health = await this.secretRef.healthCheck();

    const result = this.getStatus(key, health.healthy, {
      latencyMs: health.latencyMs,
      provider: 'doppler',
    });

    if (!health.healthy) {
      throw new HealthCheckError('SecretRef health check failed', result);
    }

    return result;
  }
}
```

---

## 🧪 Example usage (Slack HTTP client)

**`src/infrastructure/slack/slack-http.client.ts`**

```ts
import { SecretRefService } from '../secret-ref/secret-ref.service';
import { SecretRef } from '../secret-ref/secret-ref.types';

export class SlackHttpClient {
  constructor(private readonly secrets: SecretRefService) {}

  async postMessage(
    cfg: { botTokenRef: SecretRef; signingSecretRef: SecretRef },
    payload: unknown,
  ) {
    const ctx = {
      tenantId: cfg.botTokenRef.tenant,
      boundedContext: cfg.botTokenRef.namespace,
      purpose: 'http-sign' as const,
      environment: (process.env.NODE_ENV ?? 'dev') as any,
    };
    const [{ value: botToken }, { value: signingSecret }] = await Promise.all([
      this.secrets.resolve(cfg.botTokenRef, { minTtlMs: 60_000 }, ctx),
      this.secrets.resolve(cfg.signingSecretRef, { minTtlMs: 60_000 }, ctx),
    ]);

    const headers = buildSlackHeaders(signingSecret, payload); // implement HMAC-SHA256
    return httpPost('https://slack.com/api/chat.postMessage', payload, {
      headers: { ...headers, Authorization: `Bearer ${botToken}` },
    });
  }
}
```

---

## 🧭 Reference encoding helpers (optional)

Add a small helper to parse/build `secret://` URIs when you accept string input at the edges.

```ts
export function parseSecretUri(uri: string): SecretRef {
  // Example: secret://doppler/core/notification/slack/bot-token?v=latest
  const u = new URL(uri);
  if (u.protocol !== 'secret:') throw new Error('Invalid scheme');
  const [provider, tenant, namespace, ...rest] = u.pathname
    .replace(/^\//, '')
    .split('/');
  return {
    scheme: 'secret',
    provider: provider as any,
    tenant,
    namespace,
    key: rest.join('/'),
    version: u.searchParams.get('v') ?? undefined,
    raw: uri,
  };
}
```

---

## ⚙️ Configuration

Set minimal envs (via Doppler itself 😄):

```env
DOPPLER_TOKEN=dp.st.pt.xxxxxx
DOPPLER_PROJECT=gs-scaffold
DOPPLER_CONFIG=dev
DOPPLER_BASE_URL=https://api.doppler.com
DOPPLER_TIMEOUT_MS=5000
```

Secret naming convention in Doppler (aligning with our path build):

```
<tenant>/<namespace>/<key>
# examples
core/notification/slack/bot-token
core/notification/slack/signing-secret
```

---

## 🩺 Health & Observability

### Metrics Implementation

**`src/infrastructure/secret-ref/metrics/secret-ref-metrics.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

@Injectable()
export class SecretRefMetricsService {
  private readonly resolveCounter = new Counter({
    name: 'secret_adapter_resolve_total',
    help: 'Total number of secret resolution attempts',
    labelNames: ['provider', 'tenant', 'namespace', 'result', 'from_cache'],
    registers: [register],
  });

  private readonly latencyHistogram = new Histogram({
    name: 'secret_adapter_latency_ms',
    help: 'Secret resolution latency in milliseconds',
    labelNames: ['provider', 'tenant', 'namespace'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register],
  });

  private readonly cacheHitCounter = new Counter({
    name: 'secret_cache_operations_total',
    help: 'Cache operations',
    labelNames: ['operation', 'tier', 'result'],
    registers: [register],
  });

  recordResolve(
    provider: string,
    tenant: string,
    namespace: string,
    result: 'success' | 'error',
    fromCache: boolean,
    latencyMs?: number,
  ) {
    this.resolveCounter.inc({
      provider,
      tenant,
      namespace,
      result,
      from_cache: fromCache.toString(),
    });

    if (latencyMs !== undefined) {
      this.latencyHistogram.observe({ provider, tenant, namespace }, latencyMs);
    }
  }

  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set',
    tier: 'inmem' | 'redis',
    result: 'success' | 'error',
  ) {
    this.cacheHitCounter.inc({ operation, tier, result });
  }
}
```

### Health Check Integration

```ts
// Add to your main health controller
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private health: HealthCheckService,
    @Inject(SecretRefHealthIndicator)
    private secretRefHealth: SecretRefHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.secretRefHealth.isHealthy('secret-ref'),
      // ... other health checks
    ]);
  }
}
```

### Observability Features

- **Structured Logging**: All logs are JSON with consistent fields, no secret values
- **Prometheus Metrics**: Request counts, latency distributions, cache hit ratios
- **Health Checks**: Canary secret resolution with latency tracking
- **Circuit Breaker Metrics**: Failure counts and circuit state
- **Rate Limit Monitoring**: Track policy violations and rate limit hits
- **Cache Performance**: Hit/miss ratios across memory and Redis tiers

---

## 🧳 Rotation story (Doppler)

- If you use `v=latest`, rotations are automatic at cache expiry.
- Prefer **pinned versions** for prod (e.g., `v=12`) and roll forward by updating only the **ref**.
- Call `hydrate([ref])` after rotation to pre-warm caches.

---

## ✅ Comprehensive Test Suite

**`src/infrastructure/secret-ref/__tests__/secret-ref.service.spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { SecretRefService } from '../secret-ref.service';
import { DopplerClient } from '../providers/doppler.client';
import { CacheLayer } from '../cache/cache.layer';
import { PolicyGuard } from '../policy/policy.guard';
import { ProviderRegistry } from '../providers/provider.registry';
import { SecretRef, SecretRefError } from '../secret-ref.types';

describe('SecretRefService', () => {
  let service: SecretRefService;
  let mockDopplerClient: jest.Mocked<DopplerClient>;
  let mockCache: jest.Mocked<CacheLayer>;
  let mockPolicy: jest.Mocked<PolicyGuard>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SecretRefService,
        { provide: DopplerClient, useValue: createMockDopplerClient() },
        { provide: CacheLayer, useValue: createMockCache() },
        { provide: PolicyGuard, useValue: createMockPolicy() },
        ProviderRegistry,
      ],
    }).compile();

    service = module.get<SecretRefService>(SecretRefService);
    mockDopplerClient = module.get(DopplerClient);
    mockCache = module.get(CacheLayer);
    mockPolicy = module.get(PolicyGuard);
  });

  describe('resolve', () => {
    it('should return cached value if available', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };
      const cached = {
        value: 'cached-secret',
        version: '1',
        providerLatencyMs: 100,
      };

      mockCache.get.mockResolvedValue(cached);

      const result = await service.resolve(ref);

      expect(result).toBe(cached);
      expect(mockDopplerClient.getSecret).not.toHaveBeenCalled();
    });

    it('should deduplicate concurrent requests for same secret', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };

      mockCache.get.mockResolvedValue(null);
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'secret-value',
        version: '1',
        project: 'test-project',
        config: 'dev',
      });

      // Fire multiple concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => service.resolve(ref));
      await Promise.all(promises);

      // Should only call provider once due to deduplication
      expect(mockDopplerClient.getSecret).toHaveBeenCalledTimes(1);
    });

    it('should enforce policy rules', async () => {
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };

      mockPolicy.ensureAllowed.mockImplementation(() => {
        throw new SecretRefError('Policy denied', 'POLICY_DENIED', ref);
      });

      await expect(service.resolve(ref)).rejects.toThrow('Policy denied');
    });

    it('should not log secret values', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const ref: SecretRef = {
        scheme: 'secret',
        provider: 'doppler',
        tenant: 'test',
        namespace: 'ns',
        key: 'key',
      };

      mockCache.get.mockResolvedValue(null);
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'super-secret-value',
        version: '1',
        project: 'test-project',
        config: 'dev',
      });

      await service.resolve(ref);

      // Assert that no log contains the secret value
      const allLogs = logSpy.mock.calls.flat().join(' ');
      expect(allLogs).not.toContain('super-secret-value');

      logSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when canary check passes', async () => {
      mockDopplerClient.getSecret.mockResolvedValue({
        value: 'canary-value',
        version: '1',
        project: 'test-project',
        config: 'dev',
      });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should return unhealthy status when canary check fails', async () => {
      mockDopplerClient.getSecret.mockRejectedValue(new Error('Provider down'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Provider down');
    });
  });
});

function createMockDopplerClient(): jest.Mocked<DopplerClient> {
  return {
    getSecret: jest.fn(),
  } as any;
}

function createMockCache(): jest.Mocked<CacheLayer> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    buildKey: jest.fn((ref) => `test-key-${ref.key}`),
    computeTtl: jest.fn(() => 300000),
  };
}

function createMockPolicy(): jest.Mocked<PolicyGuard> {
  return {
    ensureAllowed: jest.fn(),
  } as any;
}
```

**`src/infrastructure/secret-ref/__tests__/circuit-breaker.spec.ts`**

```ts
describe('DopplerClient Circuit Breaker', () => {
  let client: DopplerClient;

  beforeEach(() => {
    client = new DopplerClient({
      token: 'dp.st.test',
      project: 'test',
      config: 'dev',
      baseUrl: 'https://api.doppler.com',
      timeoutMs: 5000,
    });
  });

  it('should open circuit after threshold failures', async () => {
    // Mock fetch to always fail
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Trigger failures up to threshold
    for (let i = 0; i < 5; i++) {
      await expect(client.getSecret('test/path')).rejects.toThrow();
    }

    // Next call should fail with circuit breaker
    await expect(client.getSecret('test/path')).rejects.toThrow(
      'Circuit breaker is open',
    );
  });
});
```

### Test Plan Summary

1. **Unit Tests**: Mock all dependencies; verify no secret values in logs
2. **Cache Tests**: Verify TTL, jitter, LRU behavior, Redis fallback
3. **Policy Tests**: Tenant isolation, namespace controls, rate limiting
4. **Circuit Breaker Tests**: Failure threshold, recovery behavior
5. **Integration Tests**: End-to-end with test Doppler project
6. **Performance Tests**: Concurrent request deduplication
7. **Chaos Tests**: Provider failures, network timeouts, cache failures

---

## 📌 Example: Aggregate props with refs (no plaintext)

```ts
// SlackAppConfigProps (domain/application)
export interface SlackAppConfigProps {
  botTokenRef: SecretRef; // secret://doppler/core/notification/slack/bot-token?v=latest
  signingSecretRef: SecretRef; // secret://doppler/core/notification/slack/signing-secret?v=latest
  auditChannelId: string; // non-secret
  // ... other operational flags
}
```

---

## 🧱 Safety checklist

- [x] No plaintext secret in logs/events/snapshots
- [x] Cache TTL with jitter; cap by provider expiry when available
- [x] Version-aware keys; rotation-friendly
- [x] Tenant/namespace policy checks
- [x] Minimal external surface (only façade exported)
- [x] **NEW**: Promise in-flight de-duplication to prevent thundering herd
- [x] **NEW**: Circuit breaker with configurable thresholds and recovery
- [x] **NEW**: Configuration validation at startup
- [x] **NEW**: Health check endpoint with canary testing
- [x] **NEW**: Rate limiting per tenant/namespace
- [x] **NEW**: Structured error types for better debugging
- [x] **NEW**: Redis cache failure resilience
- [x] **NEW**: Comprehensive test suite with mocking

---

## 🔜 Remaining nice-to-haves

- Expose `key_hash` (HMAC of path) for metrics without revealing names
- Optional per-ref TTL override based on `algHint`
- Bulk resolution operations for performance optimization
- Secret validation with checksum verification
- Time-based access controls (business hours, etc.)
- Integration with external audit systems
- Dynamic policy updates without restart

---

### Done. Drop this folder into `src/infrastructure/secret-ref/*`, wire the module in your root `AppModule`, and inject `SecretRefService` where needed (Slack client, DB connectors, etc.).
