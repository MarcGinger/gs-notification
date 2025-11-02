# Job Payload & Addressing — Implementation

> Purpose: define the **minimal BullMQ job shape** and **addressing scheme** for Slack message requests. Keep jobs tiny, secret‑free, and easy to correlate across ESDB, Redis, and logs.

---

## 1) Principles

- **Reference only**: jobs carry **identifiers**, not full objects.
- **Secret‑free**: no tokens, signing secrets, or large config blobs in jobs.
- **Freshness**: the worker loads the latest config at processing time.
- **Single source of truth**: ESDB stream + Redis snapshot are authoritative; the job is just a pointer.

---

## 2) Job Schema (BullMQ)

```ts
export type SendMessageJob = {
  messageRequestId: string; // UUID of the request
  tenant: string; // logical tenant key
  threadTs?: string | null; // optional Slack thread ts
};
```

**Queue name**: `MessageRequestQueue`

**Job name**: `send-message-request`

**Recommended options**:

- `attempts: 1` (executor implements Slack-aware internal retries)
- `removeOnComplete: 100`, `removeOnFail: 50`
- Optional `priority` / `delay` when enqueuing

---

## 3) Addressing (Keys & Streams)

### 3.1 Redis Entity (snapshot)

- **Key (hash):** `notification.slack:v1:{tenant}:message-request:{id}`
- **Fields (selected):** `id`, `tenant`, `workspaceCode`, `templateCode?`, `channelCode?`, `recipient?`, `data` (JSON), `status`, `version`, `createdAt`, `updatedAt`, `lastStreamRevision`

### 3.2 Redis Indexes

- **Updated index (ZSET):** `notification.slack:v1:{tenant}:idx:message-request:updated`
- **By status (SET):** `notification.slack:v1:{tenant}:idx:message-request:by-status:{status}`

### 3.3 Idempotency Keys

- **Dispatch-once (projector):**
  - `notification.slack:v1:{tenant}:message-request:{id}:dispatched` → `SETNX`

- **Send-lock (worker):**
  - `notification.slack:v1:{tenant}:message-request:{id}:send-lock` → `SETNX EX 900`

_(All keys use a cluster hash‑tag on `{tenant}` for slot locality.)_

### 3.4 ESDB Stream

- **Stream:** `notification.slack.request-{tenant}-{messageRequestId}`
- **Events (from domain):** `…MessageSent.v1`, `…MessageFailed.v1`

---

## 4) Projector → Queue

**When to enqueue**

- On `MessageRequestCreated`, or
- On `MessageRequestUpdated` when `status → queued`

**How to enqueue**

```ts
await queue.add('send-message-request', {
  messageRequestId: params.id,
  tenant: params.tenant,
});
```

**Do not enqueue** template/workspace/channel objects or any secrets.

---

## 5) Worker Resolution Flow

Given `{ messageRequestId, tenant }`:

1. **Idempotency**: `SETNX send-lock`. If already set → skip.
2. **Load request** by id (Redis query repo).
3. **Load config by codes** (workspace/template/channel/app-config) from Redis.
4. **Derive channelId**: channel.channelId || request.recipient || workspace.defaultChannelId.
5. **Render & send** via SlackApiService (internal backoff / Retry‑After).
6. **Report outcome** through application port (domain records Sent/Failed events in ESDB).

---

## 6) Logging & Correlation

Include these tags in every log line:

- `tenant`, `messageRequestId`, `workspaceCode`, `templateCode?`, `channelCode?`, `jobId`, `correlationId`

Never log tokens or secrets. Mask Slack error bodies; prefer normalized error codes.

---

## 7) Migration (from enriched jobs)

1. Introduce minimal job shape and queue API.
2. Switch projector to enqueue **reference-only** jobs.
3. Update worker to resolve config from Redis by codes.
4. Keep backward compatibility briefly (dual-read) then remove enriched path.

---

## 8) Acceptance Checklist

- [ ] Jobs carry only `{ tenant, messageRequestId, threadTs? }`.
- [ ] No secrets/config blobs in job payloads or queue logs.
- [ ] Projector sets `:dispatched` SETNX before enqueue.
- [ ] Worker sets `:send-lock` SETNX (TTL) before send.
- [ ] Worker resolves config by codes, not from job.
- [ ] Domain emits `…MessageSent/Failed.v1` to ESDB on outcome.
- [ ] Redis snapshot reflects final `status` via projector.
