import { Injectable, Inject } from '@nestjs/common';
import { ProviderRegistry } from './providers/provider.registry';
import { CacheLayer } from './cache/cache.layer';
import { PolicyGuard } from './policy/policy.guard';
import {
  ResolveOptions,
  ResolvedSecret,
  SecretRef,
  SecretResolutionContext,
} from './secret-ref.types';
import { maskKey } from './utils/mask.util';
import { Logger, componentLogger, BOUNDED_CONTEXT_LOGGER } from '../../logging';

@Injectable()
export class SecretRefService {
  private readonly log: Logger;
  private readonly inFlightPromises = new Map<
    string,
    Promise<ResolvedSecret>
  >();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly cache: CacheLayer,
    private readonly policy: PolicyGuard,
    @Inject(BOUNDED_CONTEXT_LOGGER) baseLogger: Logger,
  ) {
    this.log = componentLogger(baseLogger, 'SecretRefService');
  }

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
