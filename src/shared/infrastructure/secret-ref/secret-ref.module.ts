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
import { SecretRefMetricsService } from './metrics/secret-ref-metrics.service';

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
    SecretRefMetricsService,

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
  exports: [
    SecretRefService,
    SecretRefHealthIndicator,
    SecretRefMetricsService,
  ],
})
export class SecretRefModule {}
