import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { EsdbHealthIndicator } from './indicators/esdb.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.health.indicator';
import { OpaHealthIndicator } from './indicators/opa.health.indicator';
import { DatabaseHealthService } from '../shared/infrastructure/database';
import { RepositoryMetricsService } from '../shared/application/metrics/repository-metrics.service';
import { InMemoryCacheService } from '../shared/application/caching/cache.service';

// Import clients - adapt these to your existing providers
import { DataSource } from 'typeorm';
import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { Redis } from 'ioredis';
import { LoggingModule } from 'src/shared/logging';
import { ConfigManager } from '../shared/config/config.manager';
import {
  CACHE_SERVICE,
  ESDB_CLIENT,
  REDIS,
  OPA_BASE_URL,
  EVENTSTORE_ESDB_CONNECTION_STRING,
  CACHE_REDIS_URL,
  OPA_BASE_URL_CONFIG_KEY,
} from '../shared/constants/injection-tokens';

@Module({
  imports: [LoggingModule, TerminusModule],
  controllers: [HealthController],
  providers: [
    // Health indicators
    EsdbHealthIndicator,
    RedisHealthIndicator,
    PostgresHealthIndicator,
    OpaHealthIndicator,

    // Database health service
    DatabaseHealthService,

    // Repository metrics and cache services (optional)
    {
      provide: RepositoryMetricsService,
      useClass: RepositoryMetricsService,
    },
    {
      provide: CACHE_SERVICE,
      useClass: InMemoryCacheService,
    },

    // Dependency providers - Replace these with your existing DI tokens
    {
      provide: ESDB_CLIENT,
      useFactory: () => {
        const configManager = ConfigManager.getInstance();
        const endpoint =
          configManager.get(EVENTSTORE_ESDB_CONNECTION_STRING) ||
          'esdb://localhost:2113?tls=false';
        return KurrentDBClient.connectionString(endpoint);
      },
    },
    {
      provide: DataSource,
      useFactory: () => {
        const configManager = ConfigManager.getInstance();
        const dbConfig = configManager.getDatabaseConfig();
        const ds = new DataSource({
          type: 'postgres',
          url: dbConfig.url,
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          username: dbConfig.username,
          password: dbConfig.password,
          schema: dbConfig.schema,
          // Add your entities, migrations, etc.
        });
        // Note: DataSource will be initialized lazily in the indicator
        return ds;
      },
    },
    {
      provide: REDIS,
      useFactory: (): Redis => {
        const configManager = ConfigManager.getInstance();
        const redisUrl =
          configManager.get(CACHE_REDIS_URL) || 'redis://localhost:6379';
        return new Redis(redisUrl);
      },
    },
    {
      provide: OPA_BASE_URL,
      useFactory: () => {
        const configManager = ConfigManager.getInstance();
        return (
          configManager.get(OPA_BASE_URL_CONFIG_KEY) || 'http://localhost:8181'
        );
      },
    },
  ],
})
export class HealthModule {}
