# COPILOT_INSTRUCTIONS-OUTBOX — Option A: ESDB-Native Outbox (Log-Driven Dispatcher)

> This document describes how to implement a **generic outbox pattern** using **EventStoreDB** as the single source of truth and **BullMQ** as the message transport. No SQL outbox table is required. The event log itself *is* the outbox, and a **relay subscriber** performs safe, idempotent dispatch.

---

## 1. Architecture Overview

```
Command → ESDB Append(Event) → Relay Subscriber → BullMQ → Worker → ESDB Outcome(Event)
```

### Key Points
- **Single write**: only the ESDB append is transactional.
- **Relay subscriber**: listens to category streams and enqueues minimal jobs.
- **BullMQ jobs**: reference-only payloads (`{ tenant, requestId }`).
- **Workers**: resolve full data from Redis/ESDB, execute external side-effects, and record outcome back to ESDB.

---

## 2. Goals

✅ Eliminate dual writes (no SQL outbox table).  
✅ Guarantee exactly-once enqueue with **eventId-based deduplication**.  
✅ Keep job payloads secret-free and small.  
✅ Preserve full traceability through ESDB metadata.

---

## 3. Stream & Job Addressing

### 3.1 ESDB Streams
```
<bounded-context>.<aggregate>.request-{tenant}-{requestId}
```
Each append contains metadata:
```json
{
  "correlationId": "cmd-uuid",
  "causationId": "cmd-uuid",
  "source": "service://<bounded-context>/<aggregate>",
  "tenant": "core",
  "eventId": "a6c3...",
  "intent": "outbox"
}
```

### 3.2 BullMQ Job Payload
```ts
interface OutboxJobPayload {
  tenant: string;
  requestId: string;
}

await queue.add('execute-request', { tenant, requestId }, {
  jobId: event.eventId,      // dedupe key
  attempts: 1,
});
```

### 3.3 Redis Keys
```
<namespace>:v1:{tenant}:dispatched:{eventId}  → 1  (SETNX)
<namespace>:v1:{tenant}:execute-lock:{id}     → 1  (SETNX EX 900)
```

---

## 4. Outbox Relay Subscriber

### 4.1 Responsibilities
1. Subscribe to ESDB category streams (e.g. `<bounded-context>.<aggregate>.request-`).
2. Filter only events that carry `intent: "outbox"` or event-type suffixes like `Created` or `Queued`.
3. For each event:
   - Compute dedupe key = `event.eventId`.
   - If not already marked `dispatched:{eventId}`, enqueue minimal BullMQ job.
   - Store dispatch marker (`SETNX`) and advance checkpoint.

### 4.2 Pseudocode
```ts
for await (const event of esdb.subscribeToCategory('<bounded-context>.<aggregate>.request-')) {
  if (!event.metadata.intent || event.metadata.intent !== 'outbox') continue;

  const dispatchedKey = `${namespace}:v1:{${tenant}}:dispatched:${event.id}`;
  const already = await redis.set(dispatchedKey, '1', 'NX');
  if (already !== 'OK') continue; // already dispatched

  await bullmq.add('execute-request', { tenant, requestId: event.data.id }, {
    jobId: event.id, attempts: 1,
  });
}
```

### 4.3 Checkpoints
Use an existing `CheckpointStore` (Redis or ESDB) to track last processed revision per subscription group:
```
<bounded-context>.<aggregate>.relay.checkpoint
```

---

## 5. Worker Execution

### Flow
1. Acquire `execute-lock:{id}` via `SETNX`.
2. Resolve full snapshot/config from Redis or ESDB.
3. Call the appropriate external API service or executor.
4. Record outcome event in ESDB (`…Completed.v1`, `…Failed.v1`).
5. Projectors update Redis snapshot and metrics.

---

## 6. Idempotency Strategy

| Layer | Mechanism |
|--------|------------|
| Relay Subscriber | `SETNX dispatched:{eventId}` guard + `jobId = eventId` |
| BullMQ | jobId ensures only one job instance per eventId |
| Worker | `execute-lock:{id}` prevents concurrent executions |
| Provider | `idempotencyKey = tenant:requestId:version` (optional) |
| Aggregate | Optimistic concurrency control (expected revision) |

---

## 7. Error & Retry Policy
- Relay retries on transient ESDB/Redis errors; use backoff.
- Worker uses exponential backoff and respects `Retry-After` headers.
- Failed jobs emit `…Failed.v1` events; retries are triggered via domain or scheduled relay, **not BullMQ attempts>1**.

---

## 8. Operational Monitoring
- **Logs**: `{tenant, eventId, requestId, jobId, stream, outcome}`
- **Metrics**:
  - `outbox_events_total{namespace}`
  - `outbox_dispatched_total{namespace}`
  - `outbox_skipped_total{namespace}`
  - `outbox_lag_ms{namespace}`

---

## 9. Benefits
- ESDB append = atomic write ⇒ no dual-write hazard.
- Simpler mental model: *Event log is the outbox.*
- No need for SQL schema or migration management.
- Works across all bounded contexts (e.g., Notification, Payment, Workflow, Integration).
- Each bounded context can have its own lightweight relay worker.

---

## 10. Migration Checklist
1. Remove enriched job payloads from projectors.
2. Introduce a relay subscriber per bounded context.
3. Enqueue `{ tenant, requestId }` only; use `eventId` as jobId.
4. Add dispatched-marker and checkpoint logic.
5. Adjust workers to resolve data dynamically.
6. Verify idempotency and event→job correlation.
7. Observe metrics for duplicate or skipped dispatches.

---

### TL;DR
This **ESDB-native outbox** delivers the same reliability as a SQL outbox table: one authoritative event append, one relay that enqueues idempotently, one worker that executes and records outcomes.  
It’s the cleanest form of **log-driven dispatch** in an event-sourced architecture.

