import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { HealthDetailResource, RepositoryHealthResponse } from './health.dto';
import { DatabaseHealthService } from '../shared/infrastructure/database';
import { EsdbHealthIndicator } from './indicators/esdb.health.indicator';
import { AppConfigUtil } from '../shared/config/app-config.util';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.health.indicator';
import { OpaHealthIndicator } from './indicators/opa.health.indicator';
import { RepositoryMetricsService } from '../shared/application/metrics/repository-metrics.service';
import {
  CacheService,
  CacheStats,
} from '../shared/application/caching/cache.service';
import { CACHE_SERVICE } from '../shared/constants/injection-tokens';

// Health check configuration constants
const HEALTH_CONSTANTS = {
  MEMORY: {
    HEAP_LIMIT_MB: 300,
    RSS_LIMIT_MB: 300,
    LIVENESS_HEAP_LIMIT_MB: 500,
    LIVENESS_RSS_LIMIT_MB: 700,
    MB_TO_BYTES: 1024 * 1024,
  },
  DEFAULTS: {
    UNKNOWN_VALUE: 'unknown',
    NOT_CONFIGURED_STATUS: 'not_configured',
    HEALTHY_STATUS: 'healthy',
    ACTIVE_STATUS: 'active',
    ERROR_STATUS: 'error',
    UNKNOWN_STATUS: 'unknown',
    MEMORY_TYPE: 'memory',
    UNKNOWN_TYPE: 'unknown',
  },
  LIMITS: {
    MAX_OPERATIONS: 10,
  },
} as const;

interface CacheServiceWithStats extends CacheService {
  getStats(): CacheStats;
}

function hasCacheStats(
  service: CacheService | undefined,
): service is CacheServiceWithStats {
  return service !== undefined && 'getStats' in service;
}
@Controller('health')
@ApiTags('Health check')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly memoryHealthIndicator: MemoryHealthIndicator,
    private readonly databaseHealthService: DatabaseHealthService,
    private readonly esdb: EsdbHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly postgres: PostgresHealthIndicator,
    private readonly opa: OpaHealthIndicator,
    @Optional() private readonly metricsService?: RepositoryMetricsService,
    @Optional()
    @Inject(CACHE_SERVICE)
    private readonly cacheService?: CacheService,
  ) {}

  /**
   * Performs a health check on memory and database.
   * Overall readiness check - backward compatible
   * @returns {Promise<any>} Health check result
   */
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Overall readiness signal - checks all dependencies',
  })
  @HealthCheck()
  async check() {
    return this.healthCheckService.check([
      // Memory checks
      () =>
        this.memoryHealthIndicator.checkHeap(
          'memory_heap',
          HEALTH_CONSTANTS.MEMORY.HEAP_LIMIT_MB *
            HEALTH_CONSTANTS.MEMORY.MB_TO_BYTES,
        ),
      () =>
        this.memoryHealthIndicator.checkRSS(
          'memory_rss',
          HEALTH_CONSTANTS.MEMORY.RSS_LIMIT_MB *
            HEALTH_CONSTANTS.MEMORY.MB_TO_BYTES,
        ),

      // Dependency checks
      () => this.postgres.ping('postgres'),
      () => this.redis.ping('redis'),
      () => this.esdb.ping('esdb'),
      () => this.opa.ping('opa'),
    ]);
  }

  /**
   * Liveness probe - cheap, in-process only
   * @returns {Promise<any>} Liveness check result
   */
  @Get('/live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Process liveness - memory only checks',
  })
  @HealthCheck()
  async live() {
    return this.healthCheckService.check([
      () =>
        this.memoryHealthIndicator.checkHeap(
          'memory_heap',
          HEALTH_CONSTANTS.MEMORY.LIVENESS_HEAP_LIMIT_MB *
            HEALTH_CONSTANTS.MEMORY.MB_TO_BYTES,
        ),
      () =>
        this.memoryHealthIndicator.checkRSS(
          'memory_rss',
          HEALTH_CONSTANTS.MEMORY.LIVENESS_RSS_LIMIT_MB *
            HEALTH_CONSTANTS.MEMORY.MB_TO_BYTES,
        ),
    ]);
  }

  /**
   * Readiness probe - can handle traffic + core deps
   * @returns {Promise<any>} Readiness check result
   */
  @Get('/ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Dependency readiness - external services',
  })
  @HealthCheck()
  async ready() {
    return this.healthCheckService.check([
      () => this.postgres.ping('postgres'),
      () => this.redis.ping('redis'),
      () => this.esdb.ping('esdb'),
      () => this.opa.ping('opa'),
    ]);
  }

  /**
   * Info metadata
   * @returns Application metadata
   */
  @Get('/info')
  @ApiOperation({
    summary: 'Info',
    description: 'Application metadata',
  })
  getInfo() {
    const systemConfig = AppConfigUtil.getSystemConfig();
    const loggingConfig = AppConfigUtil.getLoggingConfig();

    return {
      name: loggingConfig.appName,
      version: systemConfig.appVersion,
      commit: systemConfig.gitSha,
      nodeEnv: systemConfig.nodeEnv,
      environment: systemConfig.environment,
      startedAt: new Date(systemConfig.bootTime).toISOString(),
    };
  }

  /**
   * Returns detailed memory usage information.
   * @returns {HealthDetailResource} Memory usage details
   */
  @Get('/detail')
  @ApiOperation({
    summary: 'Deep health scan',
    description: 'Returns detailed memory usage and database information',
  })
  @ApiResponse({ type: HealthDetailResource, isArray: false })
  async healthDetails(): Promise<HealthDetailResource> {
    const systemConfig = AppConfigUtil.getSystemConfig();
    const memoryUsage = process.memoryUsage();

    const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotal = memoryUsage.heapTotal / 1024 / 1024;
    const arrayBuffers = memoryUsage.arrayBuffers / 1024 / 1024;
    const rss = memoryUsage.rss / 1024 / 1024;

    // Get detailed database health
    const dbHealth = await this.databaseHealthService.getHealthDetails();
    const migrationStatus =
      await this.databaseHealthService.getMigrationStatus();

    // Get detailed service health information
    const serviceHealthChecks = await Promise.allSettled([
      this.postgres
        .getDetailedInfo()
        .then((info) => ({ name: 'PostgreSQL', ...info })),
      this.redis.getDetailedInfo().then((info) => ({ name: 'Redis', ...info })),
      this.esdb
        .getDetailedInfo()
        .then((info) => ({ name: 'EventStoreDB', ...info })),
      this.opa.getDetailedInfo().then((info) => ({ name: 'OPA', ...info })),
    ]);

    const services = serviceHealthChecks.map((result, index) => {
      const serviceNames = ['PostgreSQL', 'Redis', 'EventStoreDB', 'OPA'];
      const serviceName = serviceNames[index];

      if (result.status === 'fulfilled') {
        return {
          name: serviceName,
          status: result.value.status,
          responseTime: result.value.responseTime,
          lastCheck: new Date().toISOString(),
          details: result.value.details,
          error: result.value.error,
        };
      } else {
        return {
          name: serviceName,
          status: HEALTH_CONSTANTS.DEFAULTS.UNKNOWN_STATUS,
          lastCheck: new Date().toISOString(),
          error: (result.reason as Error)?.message || 'Service check failed',
        };
      }
    });

    return {
      memory: {
        heapUsed: `${Math.round(heapUsed * 100) / 100} MB`,
        heapTotal: `${Math.round(heapTotal * 100) / 100} MB`,
        arrayBuffers: `${Math.round(arrayBuffers * 100) / 100} MB`,
        rss: `${Math.round(rss * 100) / 100} MB`,
      },
      database: {
        healthy: dbHealth.healthy,
        schema: dbHealth.schema,
        isConnected: dbHealth.isConnected,
        lastCheck: dbHealth.lastCheck,
        migrations: migrationStatus,
      },
      system: {
        uptime: process.uptime() * 1000, // Convert to milliseconds
        nodeVersion: process.version,
        appVersion: systemConfig.appVersion,
        environment: systemConfig.environment,
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
      },
      services,
    };
  }

  // ========== Repository Health Endpoints ==========

  @Get('repository')
  @ApiOperation({ summary: 'Get repository health status' })
  @ApiResponse({
    status: 200,
    description: 'Repository health information',
    type: RepositoryHealthResponse,
  })
  getRepositoryHealth() {
    if (!this.metricsService) {
      return {
        status: HEALTH_CONSTANTS.DEFAULTS.NOT_CONFIGURED_STATUS,
        message: 'Repository metrics service not available',
        timestamp: new Date().toISOString(),
      };
    }

    const healthSummary = this.metricsService.getHealthSummary();
    const metrics = this.metricsService.getMetrics();

    return {
      status: healthSummary.status,
      timestamp: new Date().toISOString(),
      summary: healthSummary,
      operations: metrics.slice(0, HEALTH_CONSTANTS.LIMITS.MAX_OPERATIONS), // Top operations
      cache: this.getCacheInfo(),
    };
  }

  @Get('repository/metrics')
  @ApiOperation({ summary: 'Get detailed repository metrics' })
  @ApiResponse({
    status: 200,
    description: 'Detailed repository metrics',
  })
  getRepositoryMetrics() {
    if (!this.metricsService) {
      return {
        status: HEALTH_CONSTANTS.DEFAULTS.NOT_CONFIGURED_STATUS,
        message: 'Repository metrics service not available',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      timestamp: new Date().toISOString(),
      metrics: this.metricsService.getMetrics(),
      summary: this.metricsService.getHealthSummary(),
    };
  }

  @Get('repository/cache')
  @ApiOperation({ summary: 'Get cache health and statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache health information',
  })
  getCacheHealth() {
    if (!this.cacheService) {
      return {
        status: HEALTH_CONSTANTS.DEFAULTS.NOT_CONFIGURED_STATUS,
        message: 'Cache service not available',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: HEALTH_CONSTANTS.DEFAULTS.HEALTHY_STATUS,
      timestamp: new Date().toISOString(),
      info: this.getCacheInfo(),
    };
  }

  private getCacheInfo() {
    if (!this.cacheService) {
      return { status: HEALTH_CONSTANTS.DEFAULTS.NOT_CONFIGURED_STATUS };
    }

    // Check if it's an InMemoryCacheService with getStats method
    if (hasCacheStats(this.cacheService)) {
      try {
        const stats = this.cacheService.getStats();
        return {
          status: HEALTH_CONSTANTS.DEFAULTS.ACTIVE_STATUS,
          type: HEALTH_CONSTANTS.DEFAULTS.MEMORY_TYPE,
          size: stats.size,
          hitRate: stats.hitRate,
          memoryUsage: stats.memoryUsage,
        };
      } catch {
        return {
          status: HEALTH_CONSTANTS.DEFAULTS.ERROR_STATUS,
          type: HEALTH_CONSTANTS.DEFAULTS.UNKNOWN_TYPE,
          error: 'Failed to get cache stats',
        };
      }
    }

    return {
      status: HEALTH_CONSTANTS.DEFAULTS.ACTIVE_STATUS,
      type: HEALTH_CONSTANTS.DEFAULTS.UNKNOWN_TYPE,
    };
  }
}
