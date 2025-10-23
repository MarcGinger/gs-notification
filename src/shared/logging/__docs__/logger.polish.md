# Centralized Logger Factory (Pino + NestJS) — Service/BC/Application Scoping

This pattern centralizes logger creation, auto-attaching `service`, `boundedContext`, and `application` to every log, and letting classes add a `component` once. It removes repetition and guarantees consistent metadata.

---

## 1) Factory + tokens

```ts
// src/shared/logging/logger.factory.ts
import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

export type Logger = PinoLogger;

export interface ServiceLoggerFactoryOpts {
  service: string;
  base?: Record<string, unknown>; // e.g., { environment, version }
  pino?: LoggerOptions; // optional pino config overrides
}

export interface GetLoggerArgs {
  boundedContext: string;
  application: string;
  component?: string;
}

export class ServiceLoggerFactory {
  private readonly baseLogger: Logger;

  constructor(opts: ServiceLoggerFactoryOpts) {
    const { service, base = {}, pino: pinoOpts } = opts;
    this.baseLogger = pino({
      name: service, // appears as `name` in pino
      ...pinoOpts,
      base: { service, ...base }, // attaches `service` globally
    });
  }

  /**
   * Returns a logger child pre-bound with boundedContext + application (+ optional component)
   */
  getLogger(args: GetLoggerArgs): Logger {
    const { boundedContext, application, component } = args;
    const childBase = {
      boundedContext,
      application,
      ...(component ? { component } : {}),
    };
    return this.baseLogger.child(childBase);
  }

  /** Optionally expose the raw base logger (service-only) */
  getServiceLogger(): Logger {
    return this.baseLogger;
  }
}

/** Convenience creator (backward-compatible name) */
export function createServiceLoggerFactory(
  service: string,
  base?: Record<string, unknown>,
  pinoOpts?: LoggerOptions,
) {
  return new ServiceLoggerFactory({ service, base, pino: pinoOpts });
}
```

```ts
// src/shared/logging/logger.tokens.ts
export const LOGGER_FACTORY = Symbol('LOGGER_FACTORY'); // provides ServiceLoggerFactory
export const APP_LOGGER = Symbol('APP_LOGGER'); // provides Logger scoped to module (service+BC+app)
```

---

## 2) Nest providers

```ts
// src/shared/logging/logging.providers.ts
import { FactoryProvider, ValueProvider } from '@nestjs/common';
import {
  createServiceLoggerFactory,
  ServiceLoggerFactory,
} from './logger.factory';
import { LOGGER_FACTORY, APP_LOGGER } from './logger.tokens';

// App-level factory (created once in AppModule)
export const loggerFactoryProvider = (
  serviceName: string,
  base?: Record<string, unknown>,
): ValueProvider => ({
  provide: LOGGER_FACTORY,
  useValue: createServiceLoggerFactory(serviceName, base),
});

/**
 * Module-scoped logger provider:
 * Binds APP_LOGGER to a child that already includes { service, boundedContext, application }.
 * Each bounded context module should register one of these.
 */
export const moduleLoggerProvider = (
  boundedContext: string,
  application: string,
): FactoryProvider => ({
  provide: APP_LOGGER,
  useFactory: (factory: ServiceLoggerFactory) =>
    factory.getLogger({ boundedContext, application }),
  inject: [LOGGER_FACTORY],
});
```

---

## 3) AppModule wiring (once)

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { loggerFactoryProvider } from './shared/logging/logging.providers';
import { ProductModule } from './contexts/catalog/product/product.module';

@Module({
  imports: [ProductModule],
  providers: [
    // Create the app-level logger factory once
    loggerFactoryProvider('gs-scaffold', {
      environment: process.env.NODE_ENV ?? 'development',
      version: '0.0.1',
    }),
  ],
})
export class AppModule {}
```

---

## 4) ProductModule wiring (bounded context + application)

```ts
// src/contexts/catalog/product/product.module.ts
import { Module } from '@nestjs/common';
import { moduleLoggerProvider } from '../../../shared/logging/logging.providers';
import { APP_LOGGER } from '../../../shared/logging/logger.tokens';
import { ProductApplicationService } from './application/services/product.application.service';
import { GetProductUseCase } from './application/use-cases/get-product.usecase';
import { ProductController } from './interfaces/http/product.controller';

@Module({
  controllers: [ProductController],
  providers: [
    ProductApplicationService,
    GetProductUseCase,

    // Bind APP_LOGGER to `{ service, boundedContext: 'catalog', application: 'product' }`
    moduleLoggerProvider('catalog', 'product'),
  ],
  exports: [APP_LOGGER],
})
export class ProductModule {}
```

---

## 5) Per-component scoping (one-liner) + helper

```ts
// src/shared/logging/log.util.ts
import { Logger } from './logger.factory';

export function componentLogger(base: Logger, component: string): Logger {
  // Create once per class to avoid repeating `component` in each call
  return base.child({ component });
}

// Optional sugar: message + runtime fields in a single call
export const Log = {
  info: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
    logger.info(fields ?? {}, message),
  warn: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
    logger.warn(fields ?? {}, message),
  error: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
    logger.error(fields ?? {}, message),
  debug: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
    logger.debug(fields ?? {}, message),
};
```

---

## 6) Usage in classes (no repetition of static fields)

```ts
// src/contexts/catalog/product/application/use-cases/get-product.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import { APP_LOGGER } from '../../../../shared/logging/logger.tokens';
import { Logger } from '../../../../shared/logging/logger.factory';
import { componentLogger, Log } from '../../../../shared/logging/log.util';

const COMPONENT = 'GetProductUseCase';

@Injectable()
export class GetProductUseCase {
  private readonly logger: Logger;

  constructor(@Inject(APP_LOGGER) moduleLogger: Logger) {
    // Attach component once
    this.logger = componentLogger(moduleLogger, COMPONENT);
  }

  async execute(
    productId: string,
    ctx: { correlationId?: string; userId?: string },
  ) {
    Log.info(this.logger, 'Executing GetProductQuery', {
      method: 'execute',
      productId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
    });

    // … do work …

    Log.info(this.logger, 'GetProductQuery executed successfully', {
      method: 'execute',
      productId,
      correlationId: ctx.correlationId,
    });

    return {
      /* result */
    } as const;
  }
}
```

```ts
// src/contexts/catalog/product/interfaces/http/product.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { APP_LOGGER } from '../../../../shared/logging/logger.tokens';
import { Logger } from '../../../../shared/logging/logger.factory';
import { componentLogger, Log } from '../../../../shared/logging/log.util';
import { GetProductUseCase } from '../../application/use-cases/get-product.usecase';

const COMPONENT = 'ProductController';

@Controller({ version: '1', path: '/api/products' })
export class ProductController {
  private readonly logger: Logger;

  constructor(
    private readonly getProduct: GetProductUseCase,
    @Inject(APP_LOGGER) moduleLogger: Logger,
  ) {
    this.logger = componentLogger(moduleLogger, COMPONENT);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    Log.debug(this.logger, 'HTTP GET /products/:id', {
      method: 'findOne',
      productId: id,
    });

    const res = await this.getProduct.execute(id, {
      correlationId: '…from ALS or header…',
      userId: '…from auth guard…',
    });

    return res;
  }
}
```

---

## 7) (Optional) Request-scoped runtime fields (ALS)

If you already use **AsyncLocalStorage** for `traceId/correlationId/userId`, you can enrich the **module logger** per request in middleware and pass it via `req.logger`, but it’s optional since runtime fields are already included in the `Log.*` calls.

---

### Benefits

- **Single factory** that standardizes all loggers.
- Every log line automatically includes **`service` + `boundedContext` + `application`**.
- Each class adds **`component`** once; subsequent calls only send **runtime fields**.
- Compatible with your existing `APP_LOGGER` pattern and Pino.

> Optional next step: add an ECS/OTel field mapper in the factory (e.g., `service.name`, `service.namespace`, `event.action`) for out-of-the-box dashboards in ELK/Grafana/Datadog.

---

## 8) ECS/OTel mapping + `@timestamp`/`level_label` (Factory Upgrade)

**Drop-in upgrade**: keep your existing API, but emit ECS/OTel-friendly fields and a human-readable level label while preserving epoch `time`.

```ts
// UPDATED src/shared/logging/logger.factory.ts (ECS/OTel-aware)
import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

export type Logger = PinoLogger;

export interface ServiceLoggerFactoryOpts {
  service: string; // e.g. 'gs-scaffold'
  base?: Record<string, unknown>; // e.g., { environment, version }
  pino?: LoggerOptions; // optional pino overrides
}

export interface GetLoggerArgs {
  boundedContext: string; // e.g. 'catalog'
  application: string; // e.g. 'product'
  component?: string; // e.g. 'GetProductUseCase'
}

export class ServiceLoggerFactory {
  private readonly baseLogger: Logger;

  constructor(opts: ServiceLoggerFactoryOpts) {
    const { service, base = {}, pino: pinoOverrides } = opts;

    // Add @timestamp and level_label while keeping numeric level for filters.
    const pinoDefaults: LoggerOptions = {
      base: {},
      formatters: {
        level(label, number) {
          return { level: number, level_label: label };
        },
        // Optionally normalize bindings here if needed
        bindings(bindings) {
          return bindings; // keep pid/hostname if you like
        },
        log(object) {
          // Keep the original object; mapping to ECS happens via our child bases below
          return object;
        },
      },
      timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
    };

    const pinoOpts: LoggerOptions = {
      ...pinoDefaults,
      ...(pinoOverrides ?? {}),
    };

    // Service-level base aligns with ECS `service.*`
    this.baseLogger = pino({
      name: service,
      ...pinoOpts,
      base: {
        // Keep epoch millis for sinks that rely on it
        // (Pino will add `time`; we also add ISO via timestamp() above)
        service: {
          name: service,
          namespace: undefined, // set at child level
          version: (base as any)?.version,
          environment: (base as any)?.environment,
        },
        // Preserve any additional base keys provided by caller
        ...base,
      },
    });
  }

  /**
   * Returns a logger child with ECS/OTel-friendly base fields for BC/App/Component
   */
  getLogger(args: GetLoggerArgs): Logger {
    const { boundedContext, application, component } = args;

    return this.baseLogger.child({
      // ECS-aligned structure
      service: {
        // inherit service.name/version/environment from parent
        namespace: boundedContext, // ECS-ish: which sub-service area / domain
      },
      application, // keep for convenience (dashboards/queries)
      boundedContext, // explicit field for domain queries
      ...(component ? { component } : {}),
    });
  }

  getServiceLogger(): Logger {
    return this.baseLogger;
  }
}

export function createServiceLoggerFactory(
  service: string,
  base?: Record<string, unknown>,
  pinoOpts?: LoggerOptions,
) {
  return new ServiceLoggerFactory({ service, base, pino: pinoOpts });
}
```

### Usage reminder (no change to call sites)

- **Modules** still use `moduleLoggerProvider('catalog', 'product')`.
- **Classes** still do `componentLogger(moduleLogger, 'GetProductUseCase')` once in constructor.

### Example output (now ECS-ish + human-readable level)

```json
{
  "@timestamp": "2025-08-19T23:59:10.803Z",
  "time": 1755646750803,
  "level": 30,
  "level_label": "info",
  "message": "GetProductQuery executed successfully",

  "service": {
    "name": "gs-scaffold",
    "namespace": "catalog",
    "version": "0.0.1",
    "environment": "development"
  },
  "application": "product",
  "component": "GetProductUseCase",

  "correlationId": "corr-bac8d16a-9098-47d4-accc-f85d9319f643",
  "event": { "action": "get_product", "outcome": "success" },
  "product": { "id": "p", "found": true },
  "repository": { "features": { "cache_enabled": true, "cache_ttl_s": 300 } }
}
```

### Optional: tiny helper to emit `message` consistently

```ts
// src/shared/logging/log.util.ts (append)
export function withMessage(fields: Record<string, unknown>, message: string) {
  // some sinks prefer `message` over `msg`
  return { message, ...fields };
}
```

> **Tip**: If you later integrate OpenTelemetry, you can add `trace: { id, span_id }` in a request middleware using AsyncLocalStorage, and the factory will propagate it via `.child()` without changing class code.
