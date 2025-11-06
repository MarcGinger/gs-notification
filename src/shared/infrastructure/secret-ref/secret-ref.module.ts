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
import {
  LoggingModule,
  BOUNDED_CONTEXT_LOGGER,
  APP_LOGGER,
  Logger,
} from '../../logging';
import { AppConfigUtil } from '../../config/app-config.util';

@Global()
@Module({
  imports: [LoggingModule],
  providers: [
    // Logger for SecretRef bounded context
    {
      provide: BOUNDED_CONTEXT_LOGGER,
      useFactory: (appLogger: Logger) => appLogger,
      inject: [APP_LOGGER],
    },

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

        // Use centralized configuration from AppConfigUtil
        const dopplerConfig = AppConfigUtil.getDopplerConfig();

        return new DopplerClient({
          // Keep token as direct env read for security - never log or expose this
          token: process.env.DOPPLER_TOKEN ?? '',
          project: dopplerConfig.project,
          config: dopplerConfig.config,
          baseUrl: dopplerConfig.baseUrl,
          timeoutMs: dopplerConfig.timeoutMs,
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
