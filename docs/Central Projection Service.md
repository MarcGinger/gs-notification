# Central Projection Service (CPS) — Turn Single Workspace Projector into a Pluggable, Multi‑Projector Service

This guide shows how to refactor the current **Workspace Projector (ESDB → Redis)** into a **Central Projection Service** that orchestrates multiple projectors (workspace, channel, template, etc.) as _plugins_.

---

## Goals

- Run **many projectors** inside a single service (or N identical pods) with clean lifecycle control.
- Keep existing **Redis pipeline optimization**, **cluster hash‑tag safety**, **version‑hint de‑dup**, and **checkpointing**.
- Make each projector a **pure handler module** (easy to add/disable) while the CPS handles orchestration.

---

## 1) Define a Generic Projector Contract

```ts
// src/projection/core/types.ts
export type ProjectorName = string;

export interface ProjectionRunOptions {
  prefixes: string[]; // EventStore stream prefixes
  batchSize?: number;
  stopOnCaughtUp?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  checkpointBatchSize?: number;
}

export interface ProjectionContext {
  logger: Logger;
  redis: Redis;
  clock: Clock;
  checkpointStore: CheckpointStore;
}

export interface ProjectionModule {
  name: ProjectorName;
  subscriptionGroup: string; // group per projector
  options: ProjectionRunOptions; // stream prefixes + tuning
  handler: (
    evt: ProjectionEvent,
    ctx: ProjectionContext,
  ) => Promise<ProjectionOutcome>;
  onInit?(ctx: ProjectionContext): Promise<void> | void;
  onDestroy?(ctx: ProjectionContext): Promise<void> | void;
}
```

---

## 2) Build a Registry for Plug‑In Projectors

```ts
// src/projection/core/registry.ts
export class ProjectionRegistry {
  private modules = new Map<ProjectorName, ProjectionModule>();

  register(module: ProjectionModule) {
    if (this.modules.has(module.name)) {
      throw new Error(`ProjectionModule "${module.name}" already registered`);
    }
    this.modules.set(module.name, module);
  }

  all(): ProjectionModule[] {
    return [...this.modules.values()];
  }

  get(name: ProjectorName): ProjectionModule | undefined {
    return this.modules.get(name);
  }
}
```

---

## 3) CentralProjectionService Orchestrates Runners

```ts
// src/projection/core/central-projection.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';

@Injectable()
export class CentralProjectionService implements OnModuleInit, OnModuleDestroy {
  private running = false;

  constructor(
    private readonly registry: ProjectionRegistry,
    @Inject(APP_LOGGER) private readonly logger: Logger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CHECKPOINT_STORE) private readonly checkpointStore: CheckpointStore,
    @Inject(SLACK_CONFIG_DI_TOKENS.IO_REDIS) private readonly redis: Redis,
    @Inject(SLACK_CONFIG_DI_TOKENS.CATCHUP_RUNNER)
    private readonly catchup: CatchUpRunner,
  ) {}

  async onModuleInit() {
    // One-time global script registration
    registerRedisScripts(this.redis);

    const ctx: ProjectionContext = {
      logger: this.logger,
      redis: this.redis,
      clock: this.clock,
      checkpointStore: this.checkpointStore,
    };

    for (const mod of this.registry.all()) {
      mod.onInit?.(ctx);

      const boundHandler = (evt: ProjectionEvent) => mod.handler(evt, ctx);

      const runOptions: RunOptions = {
        prefixes: mod.options.prefixes,
        batchSize: mod.options.batchSize ?? 100,
        stopOnCaughtUp: mod.options.stopOnCaughtUp ?? false,
        maxRetries: mod.options.maxRetries ?? 3,
        retryDelayMs: mod.options.retryDelayMs ?? 1000,
        checkpointBatchSize: mod.options.checkpointBatchSize ?? 10,
      };

      this.catchup
        .runSafe(mod.subscriptionGroup, boundHandler, runOptions)
        .then((result) => {
          if (!result.ok) {
            Log.error(this.logger, 'Projection failed to start', {
              projector: mod.name,
              group: mod.subscriptionGroup,
              error: result.error.detail,
            });
          } else {
            Log.info(this.logger, 'Projection started', {
              projector: mod.name,
              group: mod.subscriptionGroup,
            });
          }
        })
        .catch((e: Error) => {
          Log.error(this.logger, 'Projection crashed on start', {
            projector: mod.name,
            group: mod.subscriptionGroup,
            error: e.message,
          });
        });
    }

    this.running = true;
    Log.info(this.logger, 'CentralProjectionService started', {
      count: this.registry.all().length,
    });
  }

  onModuleDestroy() {
    for (const mod of this.registry.all()) {
      try {
        this.catchup.stop(mod.subscriptionGroup);
        mod.onDestroy?.({
          logger: this.logger,
          redis: this.redis,
          clock: this.clock,
          checkpointStore: this.checkpointStore,
        });
      } catch (e) {
        Log.error(this.logger, 'Error stopping projector', {
          projector: mod.name,
          error: (e as Error).message,
        });
      }
    }
    this.running = false;
    Log.info(this.logger, 'CentralProjectionService stopped');
  }
}
```

---

## 4) Convert Workspace Projector Into a **Module Plugin**

Refactor the class-based projector into a _pure_ module factory. Keep all Redis/cluster/validation logic.

```ts
// src/contexts/slack-config/workspace/projection/workspace.module.ts
import { ProjectionModule, ProjectionContext } from 'src/projection/core/types';
import { WorkspaceProjectionKeys } from '../../workspace-projection-keys';
import { WorkspaceFieldValidatorUtil } from '../utilities/workspace-field-validator.util';

export function createWorkspaceProjectionModule(): ProjectionModule {
  return {
    name: WorkspaceProjectionKeys.PROJECTOR_NAME,
    subscriptionGroup: WorkspaceProjectionKeys.SUBSCRIPTION_GROUP,
    options: {
      prefixes: [WorkspaceProjectionKeys.getEventStoreStreamPrefix()],
      batchSize: 100,
      checkpointBatchSize: 10,
      stopOnCaughtUp: false,
      maxRetries: 3,
      retryDelayMs: 1000,
    },
    onInit(ctx) {
      Log.info(ctx.logger, 'Workspace module initialized');
    },
    async handler(event, ctx: ProjectionContext) {
      const tenant = TenantExtractor.extractTenant(event);

      const data = event.data as Record<string, any>;
      const snapshot =
        WorkspaceFieldValidatorUtil.createWorkspaceSnapshotFromEventData(data);
      const occurredAt =
        event.metadata?.occurredAt instanceof Date
          ? event.metadata.occurredAt
          : new Date();

      const params = {
        ...snapshot,
        tenantId: tenant,
        version: event.revision,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        deletedAt: null as Date | null,
        lastStreamRevision: String(event.revision),
      };

      // Version-hint de-dup
      if (
        await CacheOptimizationUtils.checkVersionHint(
          ctx.redis,
          tenant,
          'workspace',
          params.id,
          params.version,
        )
      ) {
        return ProjectionOutcome.SKIPPED_HINT;
      }

      const entityKey = WorkspaceProjectionKeys.getRedisWorkspaceKey(
        tenant,
        params.id,
      );
      const indexKey = WorkspaceProjectionKeys.getRedisTenantIndexKey(tenant);
      RedisClusterUtils.validateHashTagConsistency(entityKey, indexKey);

      const fieldPairs = RedisPipelineBuilder.buildFieldPairs(
        params as unknown as Record<string, unknown>,
      );
      const pipeline = ctx.redis.pipeline();

      if (params.deletedAt) {
        RedisPipelineBuilder.executeSoftDelete(
          pipeline,
          entityKey,
          indexKey,
          params.id,
          params.deletedAt,
        );
      } else {
        RedisPipelineBuilder.executeUpsert(
          pipeline,
          entityKey,
          indexKey,
          params.id,
          params.version,
          params.updatedAt,
          fieldPairs,
        );
      }

      const results = await pipeline.exec();
      const ok = results && results.every(([err]) => !err);
      const outcome = ok
        ? ProjectionOutcome.APPLIED
        : ProjectionOutcome.STALE_OCC;

      await CacheOptimizationUtils.updateVersionHint(
        ctx.redis,
        tenant,
        'workspace',
        params.id,
        params.version,
      );
      return outcome;
    },
  };
}
```

> **Migration tip:** Move logic from `projectEvent()` directly into the `handler` above. You no longer need to extend `BaseProjector`; CPS owns lifecycle and wiring.

---

## 5) Wire Modules into the Registry

```ts
// src/projection/app.module.ts
import { Module } from '@nestjs/common';
import { CentralProjectionService } from './core/central-projection.service';
import { ProjectionRegistry } from './core/registry';
import { createWorkspaceProjectionModule } from 'src/contexts/slack-config/workspace/projection/workspace.module';
// import createChannelProjectionModule, createTemplateProjectionModule, etc.

@Module({
  providers: [
    ProjectionRegistry,
    CentralProjectionService,
    // infra deps: CatchUpRunner, CheckpointStore, Redis, Clock, Logger, etc.
    {
      provide: 'PROJECTION_MODULE_BOOTSTRAP',
      useFactory: (registry: ProjectionRegistry) => {
        registry.register(createWorkspaceProjectionModule());
        // registry.register(createChannelProjectionModule());
        // registry.register(createTemplateProjectionModule());
      },
      inject: [ProjectionRegistry],
    },
  ],
})
export class ProjectionAppModule {}
```

---

## 6) Namespacing Checkpoints per Module

Ensure the `CheckpointStore` scopes by **subscriptionGroup**:

```ts
await checkpointStore.save(mod.subscriptionGroup, position);
```

---

## 7) Health, Metrics, and Ops

- Single `/health` aggregates module statuses: last revision, lag, error states.
- Keep a **metrics collector per module** or aggregate in CPS for SLOs.
- Optional `/metrics` (Prometheus): expose counts for `applied`, `skipped_hint`, `stale_occ`, failures.

---

## 8) Scale‑Out Model

- Run N identical pods of CPS.
- Use ESDB persistent subscriptions _or_ your catch‑up + shared checkpoint so only one worker handles a slice.
- Redis Cluster: keep hash‑tags consistent (validated by `RedisClusterUtils`).

---

## 9) Migration Path from Class → Module

1. Inline `projectEvent` into a `handler` function.
2. Move constructor side‑effects into module `onInit` or CPS startup.
3. Remove `BaseProjector` inheritance; CPS controls lifecycle.
4. Keep `registerRedisScripts` global (once per process) in CPS startup.

---

## 10) Optional Enhancements

- **Config‑driven registry:** toggle modules on/off per env/tenant.
- **Backpressure:** pause/resume by Redis latency, queue depth, or ESDB lag.
- **Dead‑letter queue:** on hard failures, append `stream@revision` to DLQ for triage.
- **Replay CLI:** CPS command to stop a module, reset its checkpoint, and replay from a position.

---

## File/Folder Skeleton

```
src/
  projection/
    core/
      types.ts
      registry.ts
      central-projection.service.ts
    app.module.ts
  contexts/
    slack-config/
      workspace/
        projection/
          workspace.module.ts
      channel/
        projection/
          channel.module.ts  // future
      template/
        projection/
          template.module.ts // future
```

---

## Summary

You retain all optimizations (pipelines, EVALSHA, OCC, version-hints, hash‑tags) and gain a **single ops surface** that runs multiple projectors as **plug‑ins**. Adding a new projector becomes:

1. Implement `createXProjectionModule()` returning `ProjectionModule`.
2. `registry.register(createXProjectionModule())` at startup.
3. Ship.
