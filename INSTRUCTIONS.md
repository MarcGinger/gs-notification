# 🧩 Refactor Plan — Transforming Workspace Upsert Event (No Patch, No PII)

## 🎯 Objective

Refactor the **Workspace Upsert** event to follow event‑sourcing/DDD conventions by:

- Removing transport‑layer diff artifacts (`before`, `after`, `changes`).
- **Not** emitting PII or secrets in event payloads.
- Emitting a **domain‑shaped** `data` object that is fully replayable.

---

## 🔍 Current (Legacy) Event Shape

The current payload mixes persistence/diff concerns into the event:

```json
{
  "id": "T02NLAU3P62",
  "before": {
    /* full previous state */
  },
  "after": {
    /* full new state */
  },
  "changes": {},
  "updatedAt": "2025-10-25T09:27:12.770Z",
  "version": 1
}
```

### ❌ Issues

- **Redundant state**: Duplicates entire objects (`before` & `after`).
- **Not domain‑shaped**: Consumers/projectors can’t directly apply it.
- **Leaky abstraction**: `before/after/changes` belong to repositories, not domain events.
- **PII/secrets exposure risk** if tokens or secrets are present.

---

## ✅ Target Event Shape (Domain‑Aligned, No PII)

Emit only canonical domain fields; move secrets to a **secret reference**.

**Event `data` (example):**

```json
{
  "id": "T02NLAU3P62",
  "name": "Nest complex Notifications",
  "appId": "A098FK3BQB0",
  "botUserId": "B0983QZ2GNT",
  "defaultChannelId": "C09NF3A97KL",
  "enabled": true,
  "credentialsRef": "secret://slack/workspaces/T02NLAU3P62@v1"
}
```

> **Note:** `credentialsRef` replaces any inline secrets (e.g., tokens/signing secrets).

No `patch`, no `before/after`, and **no PII** in `data`.

---

## 🧠 Design Principles

1. **Domain‑first**: Events describe business state changes, not DB diffs.
2. **Replayable**: `data` alone must be enough to rebuild state deterministically.
3. **No PII**: Never emit secrets; use `credentialsRef` + secret store.
4. **Minimal & stable schema**: Only business‑relevant fields in `data`.
5. **Idempotent projection**: Apply via simple merge semantics.

---

## 🏗️ Implementation Steps

### 1) Update Writer/Event Factory

Replace diff‑style emission with domain serialization.

**Old (conceptual):**

```ts
const event = {
  id: workspace.id,
  before: previousState,
  after: newState,
  changes: computeDiff(previousState, newState),
};
```

**New (conceptual):**

```ts
const eventData = {
  id: workspace.id,
  name: workspace.name,
  appId: workspace.appId,
  botUserId: workspace.botUserId,
  defaultChannelId: workspace.defaultChannelId,
  enabled: workspace.enabled,
  credentialsRef: workspace.credentialsRef, // reference, not secret
};

emitDomainEvent(
  'NotificationSlackConfigWorkspaceUpdated.v1',
  eventData,
  metadata,
);
```

### 2) Remove Diff Construction

- Delete logic that constructs `before`, `after`, `changes` in the writer.
- Do **not** emit `patch` arrays.

### 3) Secrets Handling (No PII)

- Store secrets in a dedicated secret service (e.g., `core-secrets`).
- Replace inline secrets with `credentialsRef` (versioned):
  - e.g., `secret://slack/workspaces/<workspaceId>@vN`.

- If credentials rotate, emit a **dedicated event** (optional):
  - `WorkspaceCredentialsRotated.v1` with the new `credentialsRef`.

### 4) Metadata Hygiene

- Keep metadata descriptive, not duplicative.
- Example fields to keep: `tenant`, `source`, `aggregate { type, id, streamId }`, `actor { userId, tenantId }`, `classification { data: "internal", piiProtected: false, encryptionRequired: false }`.
- `integrity.payloadHash` should hash **only the canonicalized `data`**.

### 5) Projector Simplification

Apply events via a simple merge; no diff interpretation required.

```ts
switch (evt.name) {
  case 'NotificationSlackConfigWorkspaceCreated.v1':
  case 'NotificationSlackConfigWorkspaceUpdated.v1':
    state = { ...state, ...evt.data }; // idempotent merge
    break;
  case 'WorkspaceCredentialsRotated.v1':
    state.credentialsRef = evt.data.credentialsRef;
    break;
}
```

### 6) Validation & Tests

- Add JSON Schema for `Workspace` (full for Create, partial for Update).
- Unit tests:
  - Ensure no `before/after/changes` keys in new events.
  - Ensure `data` contains no PII (no tokens/secrets).
  - Ensure projector replay builds the correct state from `data` only.

---

## 🔄 Event Naming & Versioning

- Keep existing names if stable: `NotificationSlackConfigWorkspaceCreated.v1`, `NotificationSlackConfigWorkspaceUpdated.v1`.
- If you are removing PII compared to legacy events, you may introduce `v2` to signal the breaking change for downstream consumers.

---

## 🧾 Example — Final Event (Sanitized)

**Event Name:** `NotificationSlackConfigWorkspaceUpdated.v1`

```json
{
  "data": {
    "id": "T02NLAU3P62",
    "name": "Nest complex Notifications",
    "appId": "A098FK3BQB0",
    "botUserId": "B0983QZ2GNT",
    "defaultChannelId": "C09NF3A97KL",
    "enabled": true,
    "credentialsRef": "secret://slack/workspaces/T02NLAU3P62@v1"
  },
  "metadata": {
    "tenant": "core",
    "source": "service://workspacewriter/workspace",
    "aggregate": {
      "type": "Workspace",
      "id": "T02NLAU3P62",
      "streamId": "notification.workspace.v1-core-T02NLAU3P62"
    },
    "actor": {
      "userId": "e9edbcb6-3320-4f73-a8ce-a7065b44ce25",
      "tenantId": "core"
    },
    "classification": {
      "data": "internal",
      "piiProtected": false,
      "encryptionRequired": false
    }
  }
}
```

---

## ✅ Outcome

- **Domain‑shaped** events that are easy to replay.
- **No PII** in event payloads; secrets handled via references.
- **Simpler projectors** using deterministic merges.
- **Cleaner schemas** with clear versioning and evolution.
