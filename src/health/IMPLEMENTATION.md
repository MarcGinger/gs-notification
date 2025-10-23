# NestJS Health Checks — ESDB, Redis, Postgres, OPA

A production-grade health subsystem for NestJS that adds **EventStoreDB**, **Redis**, **PostgreSQL**, and **OPA** checks with:

- **Liveness** & **Readiness** endpoints (Kubernetes-friendly)
- **Detailed diagnostics** endpoint
- **Tight timeouts** and safe, low-cost probes
- Clean DI with replaceable tokens / config

---

## 1) Install

```bash
npm i @nestjs/terminus @godaddy/terminus
# (Assumes you already use TypeORM / ioredis / EventStoreDB / axios)
```

---

## Helper: timeout wrapper

When an underlying client doesn't accept an AbortSignal (or you want a small common pattern), use a tiny helper to race a promise against a timeout and always clear the timer in a finally block:

```ts
// src/health/timeout.helper.ts (suggested)
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = 1000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>(
        (_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), ms)),
      ),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
```

Use this helper for DB clients and libraries that don't support AbortSignal. For clients that do (like the EventStoreDB gRPC client), prefer AbortController but still clear local timers in finally blocks.

## 2) Indicators (one per dependency)

Create files under `src/health/indicators/`. Each indicator uses the modern `HealthIndicatorService` pattern with `.check(key).up()/down()` methods instead of the deprecated `HealthIndicator` class and `HealthCheckError` exceptions.

**Key API Changes in NestJS Terminus v11:**

- ✅ Use `HealthIndicatorService` injection instead of extending `HealthIndicator`
- ✅ Return `this.healthIndicatorService.check(key).up(data)` for success
- ✅ Return `this.healthIndicatorService.check(key).down(data)` for failure
- ❌ Don't extend `HealthIndicator` class (deprecated)
- ❌ Don't throw `HealthCheckError` exceptions (deprecated)

### 2.1 ESDB (EventStoreDB)

```ts
// src/health/indicators/esdb.health.indicator.ts
import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { EventStoreDBClient, START, FORWARDS } from '@eventstore/db-client';

@Injectable()
export class EsdbHealthIndicator {
  constructor(
    private readonly esdb: EventStoreDBClient,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Cheap forward-read to exercise the gRPC channel.
   */
  async ping(key = 'esdb', timeoutMs = 1500): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer = setTimeout(() => controller.abort(), timeoutMs);

      const read = this.esdb.readAll({
        fromPosition: START,
        direction: FORWARDS,
        maxCount: 1,
        signal: controller.signal,
      });

      for await (const _ of read) break; // touch server once

      return this.healthIndicatorService
        .check(key)
        .up({ op: 'readAll', maxCount: 1 });
    } catch (err) {
      return this.healthIndicatorService
        .check(key)
        .down({ error: (err as Error)?.message });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
```

### 2.2 Redis (ioredis)

```ts
// src/health/indicators/redis.health.indicator.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async ping(key = 'redis', timeoutMs = 1000): Promise<HealthIndicatorResult> {
    try {
      // use the shared helper so the timer is always cleared
      const res = await withTimeout(this.redis.ping(), timeoutMs);
      const ok = res === 'PONG';
      if (!ok) throw new Error(`unexpected response: ${res}`);
      return this.healthIndicatorService.check(key).up({ response: 'PONG' });
    } catch (err) {
      return this.healthIndicatorService
        .check(key)
        .down({ error: (err as Error)?.message });
    }
  }
}
```

### 2.3 PostgreSQL (TypeORM DataSource)

```ts
// src/health/indicators/postgres.health.indicator.ts
import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { DataSource } from 'typeorm';

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async ping(
    key = 'postgres',
    timeoutMs = 1500,
  ): Promise<HealthIndicatorResult> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // wrap the query in the shared timeout helper (DataSource.query doesn't accept AbortSignal)
      await withTimeout(this.dataSource.query('SELECT 1'), timeoutMs);

      // Optional: treat pending migrations as warning/false per policy
      const pending = await this.dataSource.showMigrations();
      return this.healthIndicatorService
        .check(key)
        .up({ pendingMigrations: pending });
    } catch (err) {}
  }
}
```

### 2.4 OPA (HTTP health + trivial decision)

```ts
// src/health/indicators/opa.health.indicator.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import axios from 'axios';
import { withTimeout } from '../timeout.helper';

@Injectable()
export class OpaHealthIndicator {
  constructor(
    @Inject('OPA_BASE_URL') private readonly opaBaseUrl: string,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Prefer /health?bundles&plugins; also do a trivial decision query.
   * Create a tiny policy: `package health\n default allow = true`
   */
  async ping(key = 'opa', timeoutMs = 1500): Promise<HealthIndicatorResult> {
    try {
      const healthUrl = `${this.opaBaseUrl}/health?bundles=true&plugins=true`;
      await withTimeout(axios.get(healthUrl), timeoutMs);

      const decisionUrl = `${this.opaBaseUrl}/v1/data/health/allow`;
      const decision = await withTimeout(
        axios.post(decisionUrl, { input: {} }),
        timeoutMs,
      );

      const ok = decision?.data?.result === true;
      if (!ok) throw new Error('OPA decision probe failed');

      return this.healthIndicatorService.check(key).up({
        endpoints: ['GET /health', 'POST /v1/data/health/allow'],
      });
    } catch (err) {
      return this.healthIndicatorService
        .check(key)
        .down({ error: (err as Error)?.message });
    }
  }
}
```

---

## 3) Controller (liveness/readiness/detail/info)

```ts
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { EsdbHealthIndicator } from './indicators/esdb.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.health.indicator';
import { OpaHealthIndicator } from './indicators/opa.health.indicator';
import { DatabaseHealthService } from '../shared/infrastructure/database';
import { HealthDetailResource } from './health.dto';

@ApiTags('Health check')
@Controller('actuator')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly esdb: EsdbHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly postgres: PostgresHealthIndicator,
    private readonly opa: OpaHealthIndicator,
    private readonly databaseHealthService: DatabaseHealthService,
  ) {}

  // Backward-compat: overall == readiness
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Overall readiness signal',
  })
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.postgres.ping('postgres'),
      () => this.redis.ping('redis'),
      () => this.esdb.ping('esdb'),
      () => this.opa.ping('opa'),
    ]);
  }

  // Liveness: cheap, in-process only
  @Get('/live')
  @ApiOperation({ summary: 'Liveness probe', description: 'Process liveness' })
  @HealthCheck()
  async live() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 700 * 1024 * 1024),
    ]);
  }

  // Readiness: can handle traffic + core deps
  @Get('/ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Dependency readiness',
  })
  @HealthCheck()
  async ready() {
    return this.health.check([
      () => this.postgres.ping('postgres'),
      () => this.redis.ping('redis'),
      () => this.esdb.ping('esdb'),
      () => this.opa.ping('opa'),
    ]);
  }

  // Info metadata
  @Get('/info')
  @ApiOperation({ summary: 'Info', description: 'Application metadata' })
  getInfo() {
    return {
      name: process.env.APP_NAME ?? 'gs-scaffold',
      version: process.env.APP_VERSION ?? '0.0.0',
      commit: process.env.GIT_SHA ?? 'unknown',
      nodeEnv: process.env.NODE_ENV ?? 'development',
      startedAt: new Date(
        Number(process.env.BOOT_TIME ?? Date.now()),
      ).toISOString(),
    };
  }

  // Deep health scan (detailed memory + DB info)
  @Get('/detail')
  @ApiOperation({
    summary: 'Deep health scan',
    description: 'Detailed memory + DB info',
  })
  @ApiResponse({ type: HealthDetailResource, isArray: false })
  async healthDetails(): Promise<HealthDetailResource> {
    const mu = process.memoryUsage();
    const mb = (n: number) => `${Math.round((n / 1024 / 1024) * 100) / 100} MB`;

    const dbHealth = await this.databaseHealthService.getHealthDetails();
    const migrationStatus =
      await this.databaseHealthService.getMigrationStatus();

    return {
      memory: {
        heapUsed: mb(mu.heapUsed),
        heapTotal: mb(mu.heapTotal),
        arrayBuffers: mb(mu.arrayBuffers),
        rss: mb(mu.rss),
      },
      database: {
        healthy: dbHealth.healthy,
        schema: dbHealth.schema,
        isConnected: dbHealth.isConnected,
        lastCheck: dbHealth.lastCheck,
        migrations: migrationStatus,
      },
    };
  }
}
```

---

## 4) Module wiring

```ts
// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { EsdbHealthIndicator } from './indicators/esdb.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { PostgresHealthIndicator } from './indicators/postgres.health.indicator';
import { OpaHealthIndicator } from './indicators/opa.health.indicator';

// Your existing providers
import { DatabaseHealthService } from '../shared/infrastructure/database';
import { DataSource } from 'typeorm';
import { EventStoreDBClient } from '@eventstore/db-client';
import type { Redis } from 'ioredis';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    // Indicators
    EsdbHealthIndicator,
    RedisHealthIndicator,
    PostgresHealthIndicator,
    OpaHealthIndicator,

    // Detail service
    DatabaseHealthService,

    // Dependency singletons (replace with your DI/ConfigManager)
    {
      provide: EventStoreDBClient,
      useFactory: () =>
        new EventStoreDBClient({ endpoint: process.env.ESDB_ENDPOINT! }),
    },
    {
      provide: DataSource,
      useFactory: async () => {
        const ds = new DataSource({
          type: 'postgres',
          url: process.env.DATABASE_URL,
          // entities, migrations, ssl, etc.
        });
        // Lazy init in indicator
        return ds;
      },
    },
    {
      provide: 'REDIS',
      useFactory: () => {
        const IORedis = require('ioredis');
        return new IORedis(process.env.REDIS_URL);
      },
    },
    {
      provide: 'OPA_BASE_URL',
      useValue: process.env.OPA_BASE_URL || 'http://opa:8181',
    },
  ],
})
export class HealthModule {}
```

> **Adapt tokens** to your existing DI (e.g., `APP_ESDB`, `APP_REDIS`, `ConfigManager`). In indicators, inject those tokens accordingly.

---

## 5) DTOs for `/actuator/detail`

```ts
// src/health/health.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class HealthMemoryDetail {
  @ApiProperty() heapUsed!: string;
  @ApiProperty() heapTotal!: string;
  @ApiProperty() arrayBuffers!: string;
  @ApiProperty() rss!: string;
}

export class MigrationStatus {
  @ApiProperty() pending!: boolean;
  @ApiProperty({ required: false }) lastApplied?: string;
  @ApiProperty({ required: false }) count?: number;
}

export class DatabaseDetail {
  @ApiProperty() healthy!: boolean;
  @ApiProperty() schema!: string;
  @ApiProperty() isConnected!: boolean;
  @ApiProperty() lastCheck!: string;
  @ApiProperty({ type: MigrationStatus }) migrations!: MigrationStatus;
}

export class HealthDetailResource {
  @ApiProperty({ type: HealthMemoryDetail }) memory!: HealthMemoryDetail;
  @ApiProperty({ type: DatabaseDetail }) database!: DatabaseDetail;
}
```

---

## 6) Security & Swagger

- Consider leaving `/actuator/live` and `/actuator/ready` **public** (no auth) for Kubernetes probes; protect `/actuator/detail` under your normal auth.
- Register a global `ProblemDetails` schema in Swagger once, so you don’t repeat it per route.

---

## 7) Kubernetes probes (example)

```yaml
livenessProbe:
  httpGet:
    path: /actuator/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /actuator/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
```

---

## 8) Operational tips

- **Tight timeouts:** keep indicator timeouts \~1–1.5s to prevent stuck probes.
- **ESDB:** reading 1 from `$all` is low-impact and confirms connectivity. Alternatively, use a dedicated lightweight `$health` stream and append a heartbeat elsewhere.
- **OPA:** add a tiny `package health` policy with `default allow = true` to avoid coupling readiness to business policies.
- **Migrations:** decide policy: block readiness if pending migrations are required, or just annotate as warning.
- **Cost:** keep liveness checks in-process only; put network checks in readiness only.

---

## 9) Quick checklist

- [ ] `/actuator/live` returns OK without external dependencies
- [ ] `/actuator/ready` verifies Postgres, Redis, ESDB, OPA
- [ ] `/actuator/detail` returns memory + DB diagnostic info
- [ ] Timeouts configured and short
- [ ] Unauthenticated access allowed to probes (if running under K8s)
- [ ] Swagger includes ProblemDetails and Health DTOs
- [ ] DI tokens wired to your `ConfigManager` and real providers
