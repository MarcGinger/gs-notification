# Unified Execution Pattern — Notifications & Transactions

> A channel-agnostic, domain-first pattern for **request → project → queue → execute → record outcome**, using **reference-only jobs**, **Pure DDD**, and **ESDB** as the immutable source of truth. Works for Slack/Email/SMS/Webhook as well as Payments/Transfers/Settlements.

---

## 1) Why One Pattern?

Both notifications and transactions are **commands with side‑effects** executed against external systems. They share the same architectural pipeline:

```
Client/API → Create<Request> (ESDB event)
  ↓
Projector (ESDB→Redis): upsert snapshot + indexes → dispatch-once BullMQ job
  ↓
Executor (Worker): resolve snapshot & config → call External API → normalize result
  ↓
Application Port → Domain Use Case → ESDB outcome event (Sent/Completed or Failed)
  ↓
Projector updates snapshot/status, metrics, and indexes
```

---

## 2) Core Contracts (Reusable)

### 2.1 Job Payload (Reference-Only)

```ts
export type ExecuteJob = {
  tenant: string; // multi-tenant context
  requestId: string; // messageRequestId / transactionId
  threadTs?: string | null; // optional, channel-specific (e.g., Slack)
};
```

### 2.2 Application Port (Outcome Reporter)

```ts
export interface IRequestAppPort {
  recordSent?(i: {
    id: string;
    tenant: string;
    providerMessageId?: string;
    targetId?: string;
    attempts: number;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;
  recordCompleted?(i: {
    id: string;
    tenant: string;
    providerTxnId?: string;
    amount?: number;
    attempts: number;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;
  recordFailed(i: {
    id: string;
    tenant: string;
    reason: string;
    attempts: number;
    retryable?: boolean;
    lastError?: string;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;
}
```

### 2.3 Channel/Provider API Adapter

```ts
export interface ExternalExecutor {
  execute(options: {
    credentials: unknown; // bot token, SMTP creds, gateway keys, etc.
    target: string; // channelId/email/phone/account/URL
    payload: unknown; // blocks/html/text/json/payment-instruction
    idempotencyKey?: string; // for provider-side dedupe
  }): Promise<
    | { ok: true; id: string; retryAfterSec?: number }
    | { ok: false; retryable: boolean; error: string; retryAfterSec?: number }
  >;
}
```

---

## 3) Storage & Addressing (Conventions)

### 3.1 ESDB Streams

```
notification.<channel>.request-{tenant}-{requestId}
payment.<flow>.transaction-{tenant}-{requestId}
```

Events: `…Created.v1`, `…Updated.v1`, `…Sent|Completed.v1`, `…Failed.v1`

### 3.2 Redis Keys

```
<namespace>:v1:{tenant}:request:{id}        // snapshot (hash)
<namespace>:v1:{tenant}:idx:request:updated // ZSET by updatedAt
<namespace>:v1:{tenant}:idx:request:by-status:{status} // SET
<namespace>:v1:{tenant}:request:{id}:dispatched        // SETNX
<namespace>:v1:{tenant}:request:{id}:execute-lock      // SETNX EX 900
```

Where `<namespace>` is `notification.<channel>` or `payment.<flow>` and keys use `{tenant}` hash-tags for cluster locality.

---

## 4) Projector Rules

- Project **all** domain events to keep the snapshot authoritative.
- **Dispatch** BullMQ job only on:
  - `Created` **or**
  - `Updated` with status transition to `queued`.

- Use **dispatch-once** (`SETNX …:dispatched`).
- Enqueue **reference-only** job `{ tenant, requestId }` (plus optional threadTs for Slack).

---

## 5) Executor (Worker) Flow

1. **Acquire execute-lock** (`SETNX …:execute-lock` with TTL). Skip if exists.
2. **Load snapshot** by `{ tenant, requestId }` from Redis (query repo).
3. **Resolve configuration** by codes (workspace/template/channel/app-config) or gateway credentials.
4. **Construct target & payload** (render template → blocks/HTML/text/json; map transaction → provider instruction).
5. **Call ExternalExecutor.execute** with provider idempotency key (see §7).
6. **Normalize result** and call Application Port:
   - Notifications → `recordSent` or `recordFailed`
   - Transactions → `recordCompleted` or `recordFailed`

7. **Do not throw** after terminal outcomes; rely on domain events + projector to update status.

Retry policy: internal exponential backoff with jitter; honor `Retry-After` if provided; stop on non-retryable errors.

---

## 6) Domain & Use Cases

- **Aggregates**
  - Notifications: `MessageRequestAggregate` → states: `requested|validated|queued|sent|failed`
  - Transactions: `TransactionAggregate` → states: `initiated|validated|queued|completed|failed|reversed`

- **Use Cases** (per BC)
  - `CreateRequest` / `CreateTransaction`
  - `RecordSent` / `RecordCompleted`
  - `RecordFailed`

- **Invariants**
  - Idempotent `markSent/markCompleted`
  - Cannot fail after terminal success; cannot double-complete
  - Transactions may allow `reverse()`/`compensate()` depending on policy

---

## 7) Idempotency (End-to-End)

- **Projector**: `:dispatched` (SETNX) ⇒ single enqueue.
- **Executor**: `:execute-lock` (SETNX, TTL) ⇒ single in-flight execution.
- **Provider**: send an **idempotencyKey** (e.g., `tenant:requestId:version`) for gateways offering dedupe.
- **Aggregate**: idempotent success marking; OCC in repo.save (expected revision).
- **Reconciliation**: store provider ID (`providerMessageId`/`providerTxnId`) for later match.

---

## 8) Transactions — Additional Nuances

- **Funds Lifecycle**: `authorize → capture` or `reserve → post` modeled as separate events/use cases.
- **Two-Phase Execution**: split job types (e.g., `execute-authorization`, then `execute-capture`).
- **Sagas/Compensation**: domain emits `ReversalRequested` → executor issues reversal/refund.
- **Reconciliation Jobs**: scheduled jobs fetch provider ledger by `providerTxnId` and emit corrective events.
- **Amounts & Currencies**: value objects with precision/rounding rules.

---

## 9) Security & Compliance

- **No secrets in jobs**; credentials resolved at execution from encrypted workspace/gateway config or secret manager.
- **PII controls** for templates/payloads; sanitize logs.
- **Audit metadata** on all events: `tenant`, `actor`, `correlationId`, `causationId`, `occurredAt`, `source`, `schemaVersion`.

---

## 10) Observability

- **Logs**: `tenant, requestId, jobId, workspace/gateway code, target, attempts, latencyMs, outcome, correlationId` (mask secrets).
- **Metrics**:
  - `executor_attempts_total{namespace}`
  - `executor_success_total{namespace}` / `executor_failed_total{namespace,reason}`
  - `executor_latency_ms{namespace}` (histogram)
  - `queue_lag_ms{queue}`
  - Transactions: `authorized_total`, `captured_total`, `reversed_total`

---

## 11) Testing Matrix

- **Domain**: transitions, invariants, idempotency (success/failure).
- **App**: use cases append correct events/metadata; OCC.
- **Projector**: snapshot correctness; dispatch-once; index maintenance.
- **Executor**: resolves config; builds payload; retry/backoff; outcome reporting.
- **E2E**: Created→Queued→Executed→Outcome event→Projected.
- **Transactions**: authorization/capture paths; reconciliation; compensation.

---

## 12) Migration Playbook (from Enriched Jobs)

1. Introduce reference-only `ExecuteJob` and queue API.
2. Switch projectors to minimal enqueue.
3. Update workers to resolve data by IDs and codes at runtime.
4. Add provider idempotency keys and send-locks.
5. Dual-path support temporarily; remove enriched payloads after cutover.
6. Confirm via sampling that no secrets exist in BullMQ payloads/logs.

---

## 13) Ready-to-Use Skeleton (NestJS)

```
src/contexts/<namespace>/<channel-or-flow>/
 ├─ request/ (or transaction/)
 │   ├─ application/
 │   │   ├─ ports/ (IRequestAppPort, IRepository)
 │   │   ├─ use-cases/ (Create*, RecordCompleted/Sent, RecordFailed)
 │   ├─ domain/ (Aggregate, events, errors, VOs)
 │   ├─ infrastructure/
 │   │   ├─ repositories/ (ESDB repo, Redis query)
 │   │   ├─ projections/ (Projector)
 │   │   ├─ queue/ (QueueService)
 │   │   └─ processors/ (Processor/Worker)
 └─ executor/ (ExternalExecutor impl: Slack/SMTP/Twilio/Gateway)
 └─ config/ (workspace/gateway/app-config queries)
```

---

### Summary

This unified pattern lets you implement **notifications** and **transactions** with the same backbone: **reference-only jobs**, **projector-driven dispatch**, **executor-side resolution**, and **domain-recorded outcomes**. Only the **ExternalExecutor** and payload rendering differ per channel or payment flow.
