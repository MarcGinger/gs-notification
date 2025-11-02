# Core Slack Notifications — Option A (Pure DDD) Implementation Guide

> **Goal:** The _executor_ (infra worker) reports delivery outcomes to the _request_ bounded context **via application ports**. The _domain_ (aggregate) remains the **single source of state change** and the only writer of events to ESDB.

---

## 1) Architecture at a Glance

```text
[ core-slack-request ]                                   [ core-slack-execute ]
┌───────────────────────────┐                            ┌──────────────────────────┐
│ Application Layer         │◀─── ports ────────────────▶│ Infra Worker             │
│  • RecordMessageSent UC   │                            │  • BullMQ consumer       │
│  • RecordMessageFailed UC │                            │  • Slack API calls       │
│                           │                            └──────────────────────────┘
│ Domain Layer              │
│  • MessageRequestAggregate│
│  • Events: Created/Sent/  │
│    Failed/Updated         │
│                           │
│ Infra                     │
│  • ESDB Repository        │
│  • Redis Projections      │
└───────────────────────────┘
```

**Principle:** The worker never appends directly to ESDB. It calls an **application port** owned by _core-slack-request_, which executes a **use case** that loads the aggregate, enforces invariants, emits **domain events**, and persists them.

---

## 2) Responsibilities

### core-slack-execute (Worker, Infra)

- Consume `send-message-request` jobs.
- Resolve workspace token, channel, and render template.
- Call Slack API with retry/backoff honoring `Retry-After`.
- **Report** result via _request_ BC application port: `recordSent` / `recordFailed`.

### core-slack-request (Application + Domain)

- **Use cases** update the `MessageRequest` aggregate state.
- Emit **domain events** to ESDB:
  - `NotificationSlackRequestMessageSent.v1`
  - `NotificationSlackRequestMessageFailed.v1`

- Projectors update Redis read models.

---

## 3) Contracts (Ports & Commands)

### 3.1 Application Port (owned by _core-slack-request_)

```ts
export interface IMessageRequestAppPort {
  recordSent(input: {
    id: string; // messageRequestId
    tenant: string;
    slackTs: string;
    slackChannel: string;
    attempts: number;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;

  recordFailed(input: {
    id: string;
    tenant: string;
    reason: string; // normalized error code (e.g., 'invalid_auth')
    attempts: number;
    retryable?: boolean;
    lastError?: string;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;
}
```

### 3.2 Use Case Commands

```ts
export type RecordMessageSentCommand = {
  id: string;
  tenant: string;
  slackTs: string;
  slackChannel: string;
  attempts: number;
  correlationId?: string;
  causationId?: string;
  actor?: { userId: string; roles?: string[] };
};

export type RecordMessageFailedCommand = {
  id: string;
  tenant: string;
  reason: string;
  attempts: number;
  retryable?: boolean;
  lastError?: string;
  correlationId?: string;
  causationId?: string;
  actor?: { userId: string; roles?: string[] };
};
```

---

## 4) Application Layer (Use Cases)

### 4.1 RecordMessageSentUseCase

```ts
@Injectable()
export class RecordMessageSentUseCase {
  constructor(private readonly repo: IMessageRequestRepository) {}

  async exec(cmd: RecordMessageSentCommand): Promise<void> {
    const agg = await this.repo.get(cmd.tenant, cmd.id);
    agg.markSent({
      ts: cmd.slackTs,
      channel: cmd.slackChannel,
      attempts: cmd.attempts,
    });
    await this.repo.save(agg, {
      eventName: 'NotificationSlackRequestMessageSent.v1',
      correlationId: cmd.correlationId,
      causationId: cmd.causationId,
      actor: cmd.actor,
      source: 'service://core-slack-request/record-sent',
    });
  }
}
```

### 4.2 RecordMessageFailedUseCase

```ts
@Injectable()
export class RecordMessageFailedUseCase {
  constructor(private readonly repo: IMessageRequestRepository) {}

  async exec(cmd: RecordMessageFailedCommand): Promise<void> {
    const agg = await this.repo.get(cmd.tenant, cmd.id);
    agg.markFailed({
      reason: cmd.reason,
      attempts: cmd.attempts,
      retryable: !!cmd.retryable,
      lastError: cmd.lastError,
    });
    await this.repo.save(agg, {
      eventName: 'NotificationSlackRequestMessageFailed.v1',
      correlationId: cmd.correlationId,
      causationId: cmd.causationId,
      actor: cmd.actor,
      source: 'service://core-slack-request/record-failed',
    });
  }
}
```

> `IMessageRequestRepository` loads/rehydrates the aggregate, appends events to ESDB, and returns the new version. `save` accepts a small `PersistOptions` to set metadata on the envelope.

---

## 5) Domain Layer (Aggregate)

### 5.1 Aggregate API (sketch)

```ts
export class MessageRequestAggregate {
  private status: 'requested' | 'validated' | 'queued' | 'sent' | 'failed';
  private sent?: { ts: string; channel: string; attempts: number };
  private failure?: {
    reason: string;
    attempts: number;
    retryable: boolean;
    lastError?: string;
  };

  markSent(e: { ts: string; channel: string; attempts: number }) {
    if (this.status === 'sent') return; // idempotent
    if (this.status === 'failed')
      throw new DomainError('cannot_send_after_failed');
    this.apply(new MessageSentDomainEvent(e.ts, e.channel, e.attempts));
  }

  markFailed(e: {
    reason: string;
    attempts: number;
    retryable: boolean;
    lastError?: string;
  }) {
    if (this.status === 'sent') throw new DomainError('cannot_fail_after_sent');
    this.apply(
      new MessageFailedDomainEvent(
        e.reason,
        e.attempts,
        e.retryable,
        e.lastError,
      ),
    );
  }

  private onMessageSent(e: MessageSentDomainEvent) {
    this.status = 'sent';
    this.sent = { ts: e.ts, channel: e.channel, attempts: e.attempts };
  }
  private onMessageFailed(e: MessageFailedDomainEvent) {
    this.status = 'failed';
    this.failure = {
      reason: e.reason,
      attempts: e.attempts,
      retryable: e.retryable,
      lastError: e.lastError,
    };
  }
}
```

> Invariants are centralized: transitions allowed only by aggregate methods; duplicate transitions are idempotent or rejected.

---

## 6) Infra Wiring (Adapters)

### 6.1 App Port Implementation

```ts
@Injectable()
export class MessageRequestAppAdapter implements IMessageRequestAppPort {
  constructor(
    private readonly sentUC: RecordMessageSentUseCase,
    private readonly failedUC: RecordMessageFailedUseCase,
  ) {}

  async recordSent(input: Parameters<RecordMessageSentUseCase['exec']>[0]) {
    await this.sentUC.exec(input);
  }

  async recordFailed(input: Parameters<RecordMessageFailedUseCase['exec']>[0]) {
    await this.failedUC.exec(input);
  }
}
```

### 6.2 DI Registration

```ts
@Module({
  providers: [
    RecordMessageSentUseCase,
    RecordMessageFailedUseCase,
    { provide: MESSAGE_REQUEST_APP_PORT, useClass: MessageRequestAppAdapter },
  ],
  exports: [MESSAGE_REQUEST_APP_PORT],
})
export class SlackRequestApplicationModule {}
```

> `MESSAGE_REQUEST_APP_PORT` is a DI token the _executor_ imports to call `recordSent/recordFailed`.

---

## 7) Executor Worker Integration

In the worker, **inject the app port** (instead of a low-level writer) and call it after Slack API response.

```ts
constructor(
  @Inject(MESSAGE_REQUEST_APP_PORT) private readonly appPort: IMessageRequestAppPort,
  // ...
) {}

// on success
await this.appPort.recordSent({
  id: messageRequestId,
  tenant,
  slackTs: res.value.ts,
  slackChannel: res.value.channel,
  attempts: attempt,
  correlationId: request.correlationId ?? String(job.id),
  causationId: request.causationId ?? String(job.id),
  actor: { userId: 'system' },
});

// on terminal failure
await this.appPort.recordFailed({
  id: messageRequestId,
  tenant,
  reason: lastErr ?? 'unknown_error',
  attempts: attempt,
  retryable: false,
  correlationId: request.correlationId ?? String(job.id),
  causationId: request.causationId ?? String(job.id),
  actor: { userId: 'system' },
});
```

---

## 8) Streams, Events & Metadata

- **Stream name**: `notification.slack.request-{tenant}-{messageRequestId}`
- **Events**:
  - `NotificationSlackRequestMessageSent.v1`
  - `NotificationSlackRequestMessageFailed.v1`

- **Metadata**: `tenant`, `actor`, `correlationId`, `causationId`, `occurredAt`, `contentType:"application/json+domain"`, `source`.

Consistent names keep projectors simple and enable cross-service tracing.

---

## 9) Idempotency & Concurrency

- **Projector**: enqueue **once** (Created/Queued) with `SETNX` marker `message-request:dispatched:{tenant}:{id}`.
- **Worker**: `SETNX` idempotency key `idem:slack:send:{tenant}:{id}` for duplicate jobs.
- **Aggregate**: `markSent` and `markFailed` are **idempotent** vs current state.
- **Repo.save**: optimistic concurrency with stream revision or expected version.

---

## 10) Error Model & Retries

- Internal Slack retry loop (honor `Retry-After`); no BullMQ retries for `send-message-request`.
- Normalize Slack errors: `invalid_auth`, `channel_not_found`, `rate_limited`, `timeout`, `internal_error`.
- Terminal failure → `recordFailed()`; policy may requeue a fresh "send" later.

---

## 11) Testing Strategy

- **Unit (Domain):** aggregate transitions + idempotency.
- **Unit (App):** use cases invoke repo, append correct events/metadata.
- **Integration (Exec→App):** worker mocks Slack, calls `recordSent/recordFailed`, asserts ESDB events via test repo.
- **Projection/E2E:** Created → enqueue → Execute → Sent/Failed → project read model.

---

## 12) Observability

- Logs include: `tenant`, `workspaceId`, `messageRequestId`, `correlationId`, `causationId`, outcome, attempts, latency.
- Metrics: `slack_sent_total`, `slack_failed_total`, `slack_send_latency_ms`, `retries_total`.

---

## 13) Migration Notes (if moving from infra writes)

1. Introduce `IMessageRequestAppPort` and use cases.
2. Replace direct writer calls in worker with `appPort.recordSent/Failed`.
3. Ensure repo emits new domain events and projectors handle them.
4. Backfill: for already-sent requests missing events, emit compensating `MessageSent` events via a migration script.

---

## 14) Checklist

- [ ] App port introduced and exported by _core-slack-request_.
- [ ] Use cases implemented (`RecordMessageSent`, `RecordMessageFailed`).
- [ ] Aggregate exposes `markSent` / `markFailed` with invariants.
- [ ] Worker injects **app port** and calls `recordSent/Failed`.
- [ ] ESDB events appended with full metadata.
- [ ] Projectors update Redis on Sent/Failed.
- [ ] Idempotency at projector + worker.
- [ ] Tests for domain, app, and exec integration.

---

> With Option A, all state transitions live in the domain, preserving invariants and auditability. The executor remains a pure integration component, easy to scale and replace without touching business rules.
