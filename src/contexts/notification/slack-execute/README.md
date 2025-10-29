# 🧩 Core Slack Execute — Service Overview

## 🎯 Purpose

`core-slack-execute` is the **delivery service** responsible for sending validated Slack messages. It consumes jobs or events produced by `core-slack-request`, resolves configuration and templates from Redis (projected by `core-slack-config`), renders Slack Block Kit messages, and delivers them using the Slack Web API. It then emits delivery results back to EventStoreDB for full auditability.

---

## 🧩 Responsibilities

- Consume `SlackMessageRequested.v1` events or BullMQ jobs.
- Resolve **workspace**, **channel**, and **template** configurations from Redis.
- Render Slack Block Kit payloads with validated variables.
- Enforce **idempotency**, **retry**, and **backoff policies**.
- Send messages using Slack's Web API.
- Emit `SlackMessageSent.v1` and `SlackMessageFailed.v1` events to EventStoreDB.
- Expose operational metrics and logs for observability.

---

## ⚙️ Inputs & Outputs

### Inputs

- **Queue jobs** via BullMQ (`slack:execute:queue`)
- **Events** (`SlackMessageRequested.v1`) — optional direct ESDB subscription.

### Outputs

- **Events:** `SlackMessageSent.v1`, `SlackMessageFailed.v1`
- **Metrics:** `sent_total`, `failed_total`, `retry_total`, `send_latency_ms`
- **DLQ:** Failed or poison jobs sent to a Dead Letter Queue for inspection.

---

## 🧱 Data Contract (BullMQ Job)

```json
{
  "jobType": "sendSlackMessage",
  "tenantId": "core",
  "workspaceId": "T02NLAU3P62",
  "templateCode": "approval_pending",
  "recipient": "C09NF3A97KL",
  "threadTs": null,
  "data": {
    "productName": "Gold Credit Card",
    "approver": "Riaan",
    "approvalUrl": "https://app/approvals/12345"
  },
  "correlationId": "workflow-approve-1761385674-abc123",
  "requestId": "48b7a0b7-6d7f-4d05-9c41-2d404299bb82",
  "priority": "normal"
}
```

---

## 🧩 Execution Flow

```
BullMQ Job → Load workspace/config/template from Redis →
Validate variables → Render Block Kit → Send via Slack API →
Emit SlackMessageSent or SlackMessageFailed → Ack or Retry Job
```

### Config Lookup Keys

| Entity    | Redis Key Pattern                                                     |
| --------- | --------------------------------------------------------------------- |
| Workspace | `notification:slack:workspace:<tenantId>:<workspaceId>`               |
| Channel   | `notification:slack:channel:<tenantId>:<workspaceId>:<channelId>`     |
| Template  | `notification:slack:template:<tenantId>:<workspaceId>:<templateCode>` |

---

## 🔄 Idempotency & Deduplication

Use a Redis NX key per request:

```
SET idem:slack:send:<tenantId>:<requestId> NX EX 900
```

If the key already exists, skip processing. Prevents duplicate Slack messages when retries occur.

---

## 🧪 Retry & Backoff Policy

- **Max attempts:** from `SlackAppConfig.maxRetryAttempts` (default 5)
- **Base backoff:** from `SlackAppConfig.retryBackoffSeconds` (default 2)
- **Exponential backoff with jitter** for transient errors.
- Respect Slack rate limit responses (`429 Retry-After`).

### Error Classification

| Type          | Examples                                       | Handling           |
| ------------- | ---------------------------------------------- | ------------------ |
| **Retryable** | network, 5xx, rate_limited                     | Backoff and retry  |
| **Terminal**  | invalid_auth, channel_not_found, missing_scope | Emit failure event |

---

## 🔐 Security

- Tokens fetched securely from references (`botTokenRef`, `signingSecretRef`).
- No secrets logged; sensitive data redacted.
- Optional OPA policy for admin API endpoints.

---

## 💬 Slack API Integration

Primary method:

```ts
chat.postMessage({
  token: botToken,
  channel: channelId,
  text: template.fallbackText ?? 'Notification',
  blocks: renderedBlocks,
  thread_ts: optionalThreadTs,
});
```

Optional enhancements:

- Thread replies (`thread_ts`)
- Message updates (`chat.update`)
- Rich Block Kit templates (buttons, context blocks, links)

---

## 🧾 Events Emitted

### `SlackMessageSent.v1`

```json
{
  "tenantId": "core",
  "workspaceId": "T02NLAU3P62",
  "requestId": "48b7a0b7-6d7f-4d05-9c41-2d404299bb82",
  "recipient": "C09NF3A97KL",
  "templateCode": "approval_pending",
  "message": { "ts": "1730191862.000300", "channel": "C09NF3A97KL" },
  "occurredAt": "2025-10-29T21:51:10.000Z"
}
```

### `SlackMessageFailed.v1`

```json
{
  "tenantId": "core",
  "workspaceId": "T02NLAU3P62",
  "requestId": "48b7a0b7-6d7f-4d05-9c41-2d404299bb82",
  "recipient": "C09NF3A97KL",
  "templateCode": "approval_pending",
  "reason": "missing_scope:chat:write",
  "retryable": false
}
```

---

## 🏗️ Suggested Folder Structure

```
core-slack-execute/
├─ application/
│  ├─ services/
│  │  └─ slack-execute.service.ts
│  └─ policies/
│     └─ retry.policy.ts
├─ infrastructure/
│  ├─ queues/bullmq.consumer.ts
│  ├─ slack/slack.client.ts
│  ├─ readers/{workspace,channel,template}.reader.ts
│  ├─ events/esdb.publisher.ts
│  └─ telemetry/{metrics,logging}.ts
└─ interface/http/admin.controller.ts
```

---

## 🧱 Minimal Processor Example

```ts
@Processor('slack:execute:queue')
export class SlackExecuteConsumer {
  constructor(private readonly svc: SlackExecuteService) {}

  @Process({ name: 'sendSlackMessage', concurrency: 8 })
  async handle(job: Job<SendJob>): Promise<void> {
    await this.svc.execute(job.data);
  }
}

export class SlackExecuteService {
  async execute(j: SendJob) {
    const idemKey = `idem:slack:send:${j.tenantId}:${j.requestId}`;
    if (!(await this.redis.set(idemKey, '1', 'NX', 'EX', 900))) return;

    const ws = await this.readers.workspace.get(j.tenantId, j.workspaceId);
    const tpl = await this.readers.template.get(
      j.tenantId,
      j.workspaceId,
      j.templateCode,
    );
    const ch = await this.readers.channel.get(
      j.tenantId,
      j.workspaceId,
      j.recipient,
    );

    const blocks = renderBlockKit(tpl.contentBlocks, j.data);

    await this.retry.run(
      async () => {
        const res = await this.slack.postMessage({
          tokenRef: ws.botTokenRef,
          channel: ch.channelId,
          text: tpl.fallbackText ?? 'Notification',
          blocks,
          thread_ts: j.threadTs ?? undefined,
        });
        await this.events.emitSent({
          ...j,
          message: { ts: res.ts, channel: res.channel },
        });
      },
      (err) => classifySlackError(err),
    );
  }
}
```

---

## 🧩 Configuration Flags (from SlackAppConfig)

| Config                | Description                             |
| --------------------- | --------------------------------------- |
| `maxRetryAttempts`    | Maximum message retries before failure. |
| `retryBackoffSeconds` | Base backoff duration in seconds.       |
| `loggingEnabled`      | Enables detailed operation logs.        |
| `auditChannelId`      | Channel for audit messages (optional).  |
| `defaultLocale`       | Controls default message localization.  |

---

## ✅ Summary

`core-slack-execute` is the **delivery engine** for Slack notifications. It ensures messages are:

- **Securely delivered** using verified credentials.
- **Idempotent and resilient** with configurable retries.
- **Auditable** through ESDB events.
- **Observable** via structured logs and metrics.

It scales horizontally, integrates seamlessly with Redis and EventStoreDB, and guarantees reliable Slack message delivery across all tenants.
